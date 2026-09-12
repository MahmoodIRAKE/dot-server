const ERROR_CODES = {
    UNAUTHENTICATED: 'UNAUTHENTICATED',
    TOKEN_EXPIRED: 'TOKEN_EXPIRED',
    TOKEN_INVALID: 'TOKEN_INVALID',
    ACCOUNT_DEACTIVATED: 'ACCOUNT_DEACTIVATED',
    INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    CONFLICT: 'CONFLICT',
    INTERNAL_ERROR: 'INTERNAL_ERROR'
};

function sendError(res, status, code, error) {
    return res.status(status).json({
        success: false,
        error,
        code
    });
}

function normalizeErrorText(text) {
    return String(text || '')
        .trim()
        .replace(/\.+$/, '')
        .toLowerCase();
}

function isTechnicalDetail(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.toLowerCase();
    return (
        t.startsWith('auth/') ||
        t.includes('firebase') ||
        t.includes('mongo') ||
        t.includes('econnrefused') ||
        t.includes('enotfound') ||
        t.includes('e11000') ||
        t.includes('cast to') ||
        t.includes('bson') ||
        t.includes('errno') ||
        t.includes('\n    at ') ||
        /at\s+\S+\s+\(/.test(text) ||
        text.length > 180
    );
}

function inferErrorCode(status, errorText) {
    const text = normalizeErrorText(errorText);

    if (text.includes('token expired')) return ERROR_CODES.TOKEN_EXPIRED;
    if (text.includes('invalid token')) return ERROR_CODES.TOKEN_INVALID;
    if (text.includes('deactivated')) return ERROR_CODES.ACCOUNT_DEACTIVATED;
    if (text.includes('invalid credentials')) return ERROR_CODES.INVALID_CREDENTIALS;

    if (
        text.includes('already exists') ||
        text.includes('already registered') ||
        text.includes('already in use')
    ) {
        return ERROR_CODES.CONFLICT;
    }

    if (text.includes('forbidden') || text.includes('access denied') || text.includes('insufficient role')) {
        return status === 401 ? ERROR_CODES.UNAUTHENTICATED : ERROR_CODES.FORBIDDEN;
    }

    if (text.includes('not found') || text.includes('route not found')) {
        return status === 401 ? ERROR_CODES.UNAUTHENTICATED : ERROR_CODES.NOT_FOUND;
    }

    if (status === 401) return ERROR_CODES.UNAUTHENTICATED;
    if (status === 403) return ERROR_CODES.FORBIDDEN;
    if (status === 404) return ERROR_CODES.NOT_FOUND;
    if (status === 409) return ERROR_CODES.CONFLICT;
    if (status === 400 || status === 422) return ERROR_CODES.VALIDATION_ERROR;
    if (status >= 500) return ERROR_CODES.INTERNAL_ERROR;
    return ERROR_CODES.INTERNAL_ERROR;
}

function sanitizeErrorBody(body, status) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) return body;

    const looksError = body.success === false || status >= 400;
    if (!looksError) return body;

    if (body.success === undefined) body.success = false;
    if (!body.error && typeof body.message === 'string') {
        body.error = body.message;
    }

    if (isTechnicalDetail(body.error)) {
        body.error = status >= 500 ? 'Internal server error' : 'Request failed';
    }
    if (isTechnicalDetail(body.message)) {
        body.message = body.error;
    }

    if (!body.code) {
        body.code = inferErrorCode(status, body.error || body.message);
    }

    delete body.stack;
    return body;
}

function attachErrorCodes(req, res, next) {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        const status = res.statusCode || 200;
        return originalJson(sanitizeErrorBody(body, status));
    };
    next();
}

function errorHandler(err, req, res, next) {
    if (res.headersSent) {
        return next(err);
    }

    console.error('Unhandled error:', err);

    if (err.type === 'entity.parse.failed') {
        return sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, 'Invalid request body');
    }

    if (err.code === 'LIMIT_FILE_SIZE') {
        return sendError(res, 400, ERROR_CODES.VALIDATION_ERROR, 'File is too large');
    }

    const status = Number(err.status || err.statusCode) || 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    const code = inferErrorCode(safeStatus, err.message);
    const error =
        safeStatus >= 500 || isTechnicalDetail(err.message)
            ? 'Internal server error'
            : err.message || 'Request failed';

    return sendError(res, safeStatus, code, error);
}

module.exports = {
    ERROR_CODES,
    sendError,
    inferErrorCode,
    isTechnicalDetail,
    sanitizeErrorBody,
    attachErrorCodes,
    errorHandler
};
