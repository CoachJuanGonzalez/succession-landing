/**
 * Vercel Serverless Function — Succession Waitlist Submission Handler
 * Saves waitlist signups directly to Airtable "succession_waitlist" table
 *
 * Environment Variables Required (set in Vercel Dashboard):
 * - AIRTABLE_API_KEY        : Airtable Personal Access Token
 * - AIRTABLE_BASE_ID        : appDIjiOt5vdFs60V
 * - AIRTABLE_TABLE_NAME     : succession_waitlist
 */

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { name, email, role, involvement } = req.body;

        // Honeypot — bots fill this, humans don't
        if (req.body.website) {
            return res.status(200).json({ success: true, message: 'Thank you!' });
        }

        // Validation
        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required.' });
        }

        // Length limits — prevent abuse/spam
        if (name.length > 100)        return res.status(400).json({ error: 'Name is too long.' });
        if (email.length > 254)       return res.status(400).json({ error: 'Email is too long.' });
        if ((role || '').length > 100)       return res.status(400).json({ error: 'Invalid role.' });
        if ((involvement || '').length > 2000) return res.status(400).json({ error: 'Message is too long (max 2000 characters).' });

        const emailRegex = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email address.' });
        }

        const baseId    = process.env.AIRTABLE_BASE_ID;
        const tableName = process.env.AIRTABLE_TABLE_NAME || 'succession_waitlist';
        const apiKey    = process.env.AIRTABLE_API_KEY;

        if (!apiKey || !baseId) {
            console.error('Missing Airtable env vars');
            return res.status(500).json({ error: 'Server configuration error.' });
        }

        const airtableUrl = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(tableName)}`;

        const fields = {
            'name':         name.trim(),
            'email':        email.trim().toLowerCase(),
            'role':         role         || 'Not specified',
            'involvement':  involvement  || '',
            'submitted_at': new Date().toISOString(),
            'source':       'succession.pvrpose.ai'
        };

        const response = await fetch(airtableUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify({ records: [{ fields }] })
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error('Airtable error:', response.status, responseText);
            return res.status(500).json({ error: 'Failed to save your information. Please try again.' });
        }

        const result = JSON.parse(responseText);
        console.log('Waitlist signup saved:', result.records[0].id);

        return res.status(200).json({
            success: true,
            message: 'You\'re on the list!',
            id: result.records[0].id
        });

    } catch (error) {
        console.error('Waitlist submission error:', error);
        return res.status(500).json({ error: 'Unexpected error. Please try again.' });
    }
};
