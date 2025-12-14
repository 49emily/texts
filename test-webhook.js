/**
 * Test script to simulate LoopMessage webhooks
 *
 * Usage:
 *   node test-webhook.js group_created
 *   node test-webhook.js message_inbound
 */

import { v4 as uuidv4 } from "uuid";

const BASE_URL = process.env.TEST_URL || "http://localhost:3001";

const webhooks = {
  group_created: {
    alert_type: "group_created",
    group: {
      group_id: "59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b",
      name: "Test Group",
      participants: ["+13231112233", "+13233332211", "participant@icloud.com"],
    },
    recipient: "+13231112233",
    sender_name: "your.sender.name@imsg.tel",
    text: "User created the group",
    message_id: "59c55Ce8-41d6-43Cc-9116-8cfb2e696D7b",
    webhook_id: "ab5Ae733-cCFc-4025-9987-7279b26bE71b",
    api_version: "1.0",
  },

  message_inbound: {
    alert_type: "message_inbound",
    delivery_type: "imessage",
    group: {
      group_id: "d1201ebc-a7bd-4c38-a32f-f0743a1f920a",
      name: "",
      participants: ["+16463258470", "+19709992198"],
    },
    language: { code: "en", name: "English" },
    message_id: uuidv4(),
    message_type: "text",
    recipient: "+16507096507",
    sender_name: "thirdwheel@a.imsg.co",
    text: "give cathy the brunch recs in sf",
    webhook_id: uuidv4(),
  },
};

async function sendWebhook(type) {
  const webhook = webhooks[type];

  if (!webhook) {
    console.error(
      "❌ Invalid webhook type. Use: group_created or message_inbound"
    );
    process.exit(1);
  }

  const url = `${BASE_URL}/api/webhooks/loopmessage`;

  console.log(`📤 Sending ${type} webhook to ${url}`);
  console.log("📦 Payload:", JSON.stringify(webhook, null, 2));
  console.log("");

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "LoopServer",
        Connection: "close",
      },
      body: JSON.stringify(webhook),
    });

    const data = await response.json();

    console.log(`✅ Response Status: ${response.status}`);
    console.log("📥 Response:", JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Get webhook type from command line args
const webhookType = process.argv[2];

if (!webhookType) {
  console.log("Usage: node test-webhook.js <webhook_type>");
  console.log("");
  console.log("Available webhook types:");
  console.log('  - group_created    (sends "hi group!!")');
  console.log('  - message_inbound  (sends "hiiii")');
  console.log("");
  console.log("Examples:");
  console.log("  node test-webhook.js group_created");
  console.log("  node test-webhook.js message_inbound");
  console.log("");
  console.log("To test against a different URL:");
  console.log(
    "  TEST_URL=https://yourdomain.com node test-webhook.js group_created"
  );
  process.exit(0);
}

sendWebhook(webhookType);
