// Cloudflare Pages Function: /api/submit
// Handles form submissions and sends to Slack + Zapier
// Webhooks are stored in Cloudflare environment variables (secure)

export async function onRequestPost(context) {
  const { request, env } = context;
  
  try {
    const data = await request.json();
    
    // Validate
    if (!data.firstName || !data.lastName || !data.email || !data.phone) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const fullName = `${data.firstName} ${data.lastName}`;
    const source = data.source || 'Carol Royse Recruiting Website';
    
    // Build payload
    const payload = {
      ...data,
      fullName,
      source,
      submittedAt: new Date().toISOString(),
      submittedAtFormatted: new Date().toLocaleString('en-US', {
        timeZone: 'America/Phoenix',
        dateStyle: 'full',
        timeStyle: 'short'
      })
    };
    
    // Send to Slack (if configured)
    if (env.SLACK_WEBHOOK_URL) {
      await sendToSlack(payload, env);
    }
    
    // Send to Zapier (if configured)
    if (env.ZAPIER_WEBHOOK_URL) {
      await fetch(env.ZAPIER_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Application submitted' 
    }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    console.error('Function error:', error);
    return new Response(JSON.stringify({ 
      error: 'Internal error',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Handle CORS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

async function sendToSlack(data, env) {
  const slackPayload = {
    text: `🎯 New Agent Application - ${data.source}`,
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: '🎯 New Agent Application', emoji: true }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Name:*\n${data.fullName}` },
          { type: 'mrkdwn', text: `*Source:*\n${data.source}` },
          { type: 'mrkdwn', text: `*Email:*\n${data.email}` },
          { type: 'mrkdwn', text: `*Phone:*\n${data.phone}` },
          { type: 'mrkdwn', text: `*Brokerage:*\n${data.brokerage || 'N/A'}` },
          { type: 'mrkdwn', text: `*Homes Closed:*\n${data.homesClosed || '0'}` }
        ]
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: `📝 MLS: ${data.mlsId || 'N/A'} | Opt-in: ${data.optIn ? '✅' : '❌'}` }
        ]
      },
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: '📧 Email', emoji: true },
            url: `mailto:${data.email}`
          },
          {
            type: 'button',
            text: { type: 'plain_text', text: '📱 Call', emoji: true },
            url: `tel:${data.phone}`
          }
        ]
      }
    ]
  };

  await fetch(env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(slackPayload)
  });
}
