// Cloudflare Worker: Carol Royse Recruiting Form Handler
// Sends to: Lofty CRM + Slack notifications
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
      if (!data.firstName || !data.lastName || !data.email || !data.phone) {
        return new Response(JSON.stringify({ 
          error: 'Missing required fields' 
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const fullName = `${data.firstName} ${data.lastName}`;
      const source = data.source || 'Carol Royse Recruiting Website';

      // Send to Slack
      await sendSlackNotification(data, fullName, source, env);

      // Send to Lofty
      const loftyPayload = {
        name: fullName,
        email: data.email,
        phone: data.phone,
        source: source,
        notes: `Agent Application from ${source}: Closed ${data.homesClosed || 0} homes in past 12 months. Current Brokerage: ${data.brokerage || 'Not provided'}. MLS ID: ${data.mlsId || 'N/A'}. Opt-in: ${data.optIn ? 'Yes' : 'No'}`,
        tags: ['Agent Recruit', 'Website Lead', 'Career Opportunity'],
        customFields: {
          'homes_closed_12mo': data.homesClosed || '0',
          'recruiting_stage': 'New Application',
          'opt_in_tcpa': data.optIn ? 'Yes' : 'No',
          'current_brokerage': data.brokerage || '',
          'mls_id': data.mlsId || '',
          'lead_source': source
        }
      };

      const loftyResponse = await fetch('https://api.lofty.com/v1.0/leads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.LOFTY_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loftyPayload)
      });

      if (!loftyResponse.ok) {
        console.error('Lofty API error:', await loftyResponse.text());
        // Continue anyway - Slack notification already sent
      }

      const leadData = loftyResponse.ok ? await loftyResponse.json() : null;

      return new Response(JSON.stringify({ 
        success: true, 
        leadId: leadData?.id,
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

// Send Slack notification
async function sendSlackNotification(data, fullName, source, env) {
  if (!env.SLACK_WEBHOOK_URL) {
    console.log('No Slack webhook configured');
    return;
  }

  const slackPayload = {
    text: `🎯 New Agent Application - ${source}`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🎯 New Agent Application',
          emoji: true
        }
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Name:*\n${fullName}`
          },
          {
            type: 'mrkdwn',
            text: `*Source:*\n${source}`
          },
          {
            type: 'mrkdwn',
            text: `*Email:*\n${data.email}`
          },
          {
            type: 'mrkdwn',
            text: `*Phone:*\n${data.phone}`
          },
          {
            type: 'mrkdwn',
            text: `*Brokerage:*\n${data.brokerage || 'N/A'}`
          },
          {
            type: 'mrkdwn',
            text: `*Homes Closed (12mo):*\n${data.homesClosed || '0'}`
          }
        ]
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `📝 MLS ID: ${data.mlsId || 'N/A'} | Opt-in: ${data.optIn ? '✅ Yes' : '❌ No'}`
          }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📧 Email Applicant',
              emoji: true
            },
            url: `mailto:${data.email}`
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📱 Call Applicant',
              emoji: true
            },
            url: `tel:${data.phone}`
          }
        ]
      }
    ]
  };

  try {
    await fetch(env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload)
    });
  } catch (e) {
    console.error('Slack notification failed:', e);
  }
}
