<?php

namespace App\Http\Controllers;

use App\Models\Tip;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class TipController extends Controller
{
    public function store(Request $request)
    {
        $user = $request->user();

        $validated = $request->validate([
            'recipient_id' => 'required|integer|exists:users,id',
            'amount' => 'required|numeric|min:0.50|max:1000',
            'message' => 'nullable|string|max:500',
        ]);

        // Prevent tipping yourself
        if ((int)$validated['recipient_id'] === (int)$user->id) {
            return response()->json([
                'message' => 'You cannot send a tip to yourself.',
            ], Response::HTTP_UNPROCESSABLE_ENTITY);
        }

        // Check if recipient exists
        $recipient = User::findOrFail($validated['recipient_id']);

        $tip = Tip::create([
            'sender_id' => $user->id,
            'recipient_id' => $validated['recipient_id'],
            'amount' => $validated['amount'],
            'message' => $validated['message'] ?? null,
        ]);

        // Add points to recipient (1 point per dollar)
        $recipient->increment('points', (int)$validated['amount']);

        return response()->json([
            'message' => 'Tip sent successfully!',
            'data' => [
                'tip_id' => $tip->id,
                'amount' => $tip->amount,
                'recipient_name' => $recipient->name,
            ],
        ], Response::HTTP_CREATED);
    }

    public function show(Request $request, User $user)
    {
        // Get tips received by the user
        $tips = $user->receivedTips()
            ->with('sender:id,name,username')
            ->latest()
            ->paginate(10);

        $totalTipsReceived = $user->receivedTips()->sum('amount');
        $totalTipsCount = $user->receivedTips()->count();

        return response()->json([
            'data' => $tips->items(),
            'stats' => [
                'total_received' => $totalTipsReceived,
                'tips_count' => $totalTipsCount,
            ],
            'meta' => [
                'current_page' => $tips->currentPage(),
                'last_page' => $tips->lastPage(),
                'per_page' => $tips->perPage(),
                'total' => $tips->total(),
            ],
        ]);
    }
}
