/** Accept organizationCode; fall back to legacy clientId in request body. */
function organizationCodeFromBody(body) {
    return body.organizationCode || body.clientId;
}

module.exports = { organizationCodeFromBody };
