<?php

namespace App\Mail;

use App\Models\ContactSubmission;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class ContactSubmissionMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public ContactSubmission $submission)
    {
    }

    public function build(): self
    {
        return $this->subject('Leftover Chef contact submission')
            ->html(
                '<h2>New contact submission</h2>' .
                '<p><strong>Name:</strong> ' . e($this->submission->name) . '</p>' .
                '<p><strong>Email:</strong> ' . e($this->submission->email) . '</p>' .
                '<p><strong>Message:</strong><br>' . nl2br(e($this->submission->message)) . '</p>'
            );
    }
}