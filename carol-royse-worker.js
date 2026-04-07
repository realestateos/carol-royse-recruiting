// Cloudflare Worker: Lofty Lead Capture for Carol Royse Recruiting
// Deploy to: https://dash.cloudflare.com → Workers & Pages → Create Service

export default {
  async fetch(request, env, ctx) {
    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Only accept POST
    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    try {
      // Parse form data
      const data = await request.json();
      
      // Validate required fields
      if (!data.fullName || !data.email || !data.phone) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Build Lofty lead payload
      const loftyPayload = {
        name: data.fullName,
        email: data.email,
        phone: data.phone,
        source: 'Agent Recruiting Funnel',
        notes: `Agent Application: Closed ${data.homesClosed || 0} homes in past 12 months. Opt-in: ${data.optIn ? 'Yes' : 'No'}`,
        tags: ['Agent Recruit', 'Website Lead', 'Career Opportunity'],
        customFields: {
          'homes_closed_12mo': data.homesClosed || '0',
          'recruiting_stage': 'New Application',
          'opt_in_tcpa': data.optIn ? 'Yes' : 'No'
        }
      };

      // Send to Lofty
      const loftyResponse = await fetch('https://api.lofty.com/v1.0/leads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.LOFTY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loftyPayload)
      });

      if (!loftyResponse.ok) {
        const error = await loftyResponse.text();
        console.error('Lofty API error:', error);
        return new Response(JSON.stringify({ 
          error: 'Failed to create lead in Lofty' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const leadData = await loftyResponse.json();

      // Optional: Send confirmation email via Lofty
      // await sendConfirmationEmail(data.email, data.fullName, env);

      return new Response(JSON.stringify({ 
        success: true, 
        leadId: leadData.id,
        message: 'Application submitted successfully'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({ 
        error: 'Internal server error' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }
};

// Optional: Send confirmation email via Lofty
async function sendConfirmationEmail(email, name, env) {
  try {
    await fetch('https://api.lofty.com/v1.0/message/email/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.LOFTY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: email,
        subject: 'Thank you for your interest in Carol Royse Team',
        body: `Hi ${name},\n\nThank you for applying to join Carol Royse Team. We've received your application and will review it within 24 hours.\n\nBest regards,\nCarol Royse Team`
      })
    });
  } catch (e) {
    console.error('Email send failed:', e);
  }
}
