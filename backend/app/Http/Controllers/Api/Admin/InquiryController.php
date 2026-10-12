<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Inquiry;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\Request;

class InquiryController extends Controller
{
    public function index(Request $request)
    {
        $query = Inquiry::query()->with(['product:id,name,slug,type', 'assignee:id,name'])->latest();

        if ($status = $request->query('estado', $request->query('status'))) {
            $query->where('status', $status);
        }
        if ($channel = $request->query('canal')) {
            $query->where('source', $channel);
        }
        if ($term = trim((string) $request->query('q'))) {
            $query->where(function ($q) use ($term) {
                $q->where('name', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%")
                    ->orWhere('phone', 'like', "%{$term}%")
                    ->orWhere('message', 'like', "%{$term}%");
            });
        }

        return $query->paginate(min(max((int) $request->query('por_pagina', 25), 5), 100))
            ->appends($request->query());
    }

    /** Canales que llegaron alguna vez (para el filtro). */
    public function channels()
    {
        return Inquiry::query()->whereNotNull('source')->distinct()->orderBy('source')->pluck('source');
    }

    /** Detalle. Al abrir una consulta nueva pasa sola a "en proceso". */
    public function show(Request $request, Inquiry $inquiry)
    {
        if ($inquiry->status === 'nueva' && $request->user()->hasPermission('inquiries.manage')) {
            $inquiry->update(['status' => 'en_proceso']);
        }

        $inquiry->load(['product:id,name,slug,type,code', 'assignee:id,name']);

        return response()->json([
            'inquiry' => $inquiry,
            'whatsapp_url' => $this->whatsappUrl($inquiry),
            'operators' => User::query()->where('active', true)->whereNotNull('role_id')->orderBy('name')->get(['id', 'name']),
            'statuses' => Inquiry::STATUSES,
        ]);
    }

    public function update(Request $request, Inquiry $inquiry)
    {
        $data = $request->validate([
            'status' => ['required', 'in:'.implode(',', array_keys(Inquiry::STATUSES))],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'internal_note' => ['nullable', 'string', 'max:4000'],
        ]);

        if ($data['status'] === 'respondida' && ! $inquiry->replied_at) {
            $data['replied_at'] = now();
        }

        $inquiry->update($data);

        ActivityLog::log(
            $request->user()->id, 'editar', 'Inquiry', $inquiry->id,
            "Actualizó la consulta de {$inquiry->name}", null, ActivityLog::diff($inquiry)
        );

        return $inquiry->load(['product:id,name,slug,type,code', 'assignee:id,name']);
    }

    public function destroy(Request $request, Inquiry $inquiry)
    {
        ActivityLog::log($request->user()->id, 'eliminar', 'Inquiry', $inquiry->id, "Eliminó la consulta de {$inquiry->name}");
        $inquiry->delete();

        return response()->json(['ok' => true]);
    }

    private function whatsappUrl(Inquiry $inquiry): ?string
    {
        $number = preg_replace('/\D+/', '', (string) $inquiry->phone);
        if ($number === '') {
            return null;
        }

        if (strlen($number) <= 11 && ! str_starts_with($number, '54')) {
            $number = '54'.$number;
        }

        $company = Setting::get('site_name', 'RODADO Motos');
        $text = "Hola {$inquiry->name}, te escribimos de {$company} por tu consulta"
            .($inquiry->product ? " sobre {$inquiry->product->name}" : '').'.';

        return 'https://wa.me/'.$number.'?text='.rawurlencode($text);
    }
}
