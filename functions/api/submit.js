// Cloudflare Pages Function: /api/submit
// Handles form submissions and sends to Slack + Zapier

export async function onRequestPost(context) {
  const { request, env } = context;
  
  // Debug: Check if env vars are set
  const hasSlack = !!env.SLACK_WEBHOOK_URL;
  const hasZapier = !!env.ZAPIER_WEBHOOK_URL;
  
  console.log('Env vars check:', { hasSlack, hasZapier });
  
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
    
    const payload = {
      ...data,
      fullName,
      source,
      submittedAt: new Date().toISOString()
    };
    
    // Send to Slack
    if (env.SLACK_WEBHOOK_URL) {
      try {
        const slackPayload = {
          text: `🎯 New Agent: ${fullName}`,
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
        };
        
        const slackRes = await fetch(env.SLACK_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackPayload)
        });
        
        console.log('Slack response:', slackRes.status);
      } catch (e) {
        console.error('Slack error:', e);
      }
    }
    
    // Send to Zapier
    if (env.ZAPIER_WEBHOOK_URL) {
      try {
        const zapierRes = await fetch(env.ZAPIER_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        
        console.log('Zapier response:', zapierRes.status);
      } catch (e) {
        console.error('Zapier error:', e);
      }
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Application submitted',
      debug: { hasSlack, hasZapier }
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

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
