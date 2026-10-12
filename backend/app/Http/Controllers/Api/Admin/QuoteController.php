<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ActivityLog;
use App\Models\Quote;
use Illuminate\Http\Request;

class QuoteController extends Controller
{
    public function index(Request $request)
    {
        $query = Quote::query()->with('items')->latest();

        if ($status = $request->query('status', $request->query('estado'))) {
            $query->where('status', $status);
        }

        if ($term = trim((string) $request->query('q'))) {
            $query->where(function ($q) use ($term) {
                $q->where('number', 'like', "%{$term}%")
                    ->orWhere('name', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%")
                    ->orWhere('phone', 'like', "%{$term}%");
            });
        }

        return $query->paginate((int) $request->query('por_pagina', 20));
    }

    public function update(Request $request, Quote $quote)
    {
        $data = $request->validate(['status' => ['required', 'in:pendiente,contactado,cerrada']]);
        $quote->update($data);
        ActivityLog::log($request->user()->id, 'editar', 'Quote', $quote->id, "Cambió el estado de la cotización {$quote->number}", null, ActivityLog::diff($quote));

        return $quote;
    }

    public function destroy(Request $request, Quote $quote)
    {
        ActivityLog::log($request->user()->id, 'eliminar', 'Quote', $quote->id, "Eliminó la cotización {$quote->number}");
        $quote->delete();

        return response()->json(['ok' => true]);
    }
}
