// Cloudflare Worker: Carol Royse Recruiting Form Handler
// Sends to: Slack (using provided webhook) + Optional Lofty CRM

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      });
    }

    try {
      const data = await request.json();
      
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

      // Optional: Send to Lofty CRM
      if (env.LOFTY_API_KEY) {
        await sendToLofty(data, fullName, source, env);
      }

      return new Response(JSON.stringify({ 
        success: true, 
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
  // Slack webhook URL from environment variable
  const SLACK_WEBHOOK_URL = env.SLACK_WEBHOOK_URL;

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
              text: '📧 Email',
              emoji: true
            },
            url: `mailto:${data.email}`
          },
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: '📱 Call',
              emoji: true
            },
            url: `tel:${data.phone}`
          }
        ]
      }
    ]
  };

  try {
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackPayload)
    });

    if (!response.ok) {
      console.error('Slack webhook failed:', await response.text());
    }
  } catch (e) {
    console.error('Slack notification error:', e);
  }
}

// Send to Lofty CRM
async function sendToLofty(data, fullName, source, env) {
  try {
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

    const response = await fetch('https://api.lofty.com/v1.0/leads', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.LOFTY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(loftyPayload)
    });

    if (!response.ok) {
      console.error('Lofty API error:', await response.text());
    }
  } catch (e) {
    console.error('Lofty send failed:', e);
  }
}
