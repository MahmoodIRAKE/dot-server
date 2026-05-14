// utils/whatsapp.js
// import fetch from "node-fetch";
const fetch = require("node-fetch")
const WHATSAPP_API = (phoneNumberId) =>
    `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

/**
 * Send a WhatsApp TEMPLATE (works outside 24h window)
 * @param {Object} p
 * @param {string} p.to - E.164 digits only, e.g. "972501234567"
 * @param {string} p.fullName
 * @param {string} p.username
 * @param {string} p.tempPassword
 * @param {string} [p.loginUrl]
 * @param {string} [p.langCode] - e.g. "he" | "ar" | "en_US"
 */
export async function sendNewUserTemplate({
                                              to,
                                              fullName,
                                              username,
                                              tempPassword,
                                              loginUrl = process.env.LOGIN_URL,
                                              langCode = "he"
                                          }) {
    const url = WHATSAPP_API(process.env.WHATSAPP_PHONE_NUMBER_ID);
    const payload = {
        messaging_product: "whatsapp",
        to, // digits only
        type: "template",
        template: {
            name: "new_user_credentials",
            language: { code: langCode },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: fullName },
                        { type: "text", text: username },
                        { type: "text", text: tempPassword },
                        { type: "text", text: loginUrl }
                    ]
                }
            ]
        }
    };

    const resp = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await resp.json();
    if (!resp.ok) {
        const err = new Error(`WhatsApp send failed: ${resp.status}`);
        err.details = data;
        throw err;
    }
    return data;
}

/** Helper: convert Israeli 05X… to E.164 digits "9725…" (no +) */
export function toE164DigitsIL(local) {
    // strip non-digits
    const digits = String(local).replace(/\D/g, "");
    // remove leading 0 once, then prepend country code 972
    const without0 = digits.replace(/^0/, "");
    return `972${without0}`;
}
