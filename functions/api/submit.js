// Cloudflare Pages Function: /api/submit
// Temporarily hardcoded webhooks for testing

const SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/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';
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/21403704/u7m1nbx/';

export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    
    if (!data.firstName || !data.lastName || !data.email || !data.phone) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const fullName = `${data.firstName} ${data.lastName}`;
    
    // Send to Slack
    await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `🎯 New Agent Application`,
        blocks: [
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Name:*\n${fullName}` },
              { type: 'mrkdwn', text: `*Email:*\n${data.email}` },
              { type: 'mrkdwn', text: `*Phone:*\n${data.phone}` },
              { type: 'mrkdwn', text: `*Homes:*\n${data.homesClosed || '0'}` }
            ]
          }
        ]
      })
    });
    
    // Send to Zapier
    await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...data,
        fullName,
        submittedAt: new Date().toISOString()
      })
    });
    
    return new Response(JSON.stringify({ success: true, message: 'Application submitted' }), {
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
