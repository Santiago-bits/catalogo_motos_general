<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;

class SettingController extends Controller
{
    public function index()
    {
        return Setting::all()->pluck('value', 'key');
    }
}
