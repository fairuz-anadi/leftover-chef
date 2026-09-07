<?php

namespace App\Http\Controllers;

use App\Mail\ContactSubmissionMail;
use App\Models\ContactSubmission;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class ContactController extends Controller
{
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|max:255',
            'message' => 'required|string|min:10',
        ]);

        $submission = ContactSubmission::create($validated);

        Mail::to(env('ADMIN_EMAIL', config('mail.from.address')))->send(new ContactSubmissionMail($submission));

        return response()->json([
            'message' => 'Your message has been sent to the admin.',
            'data' => $submission,
        ], 201);
    }
}