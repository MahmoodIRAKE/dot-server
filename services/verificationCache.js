// Simple in-memory cache for verification codes
// In production, use Redis or database for better persistence

class VerificationCache {
    constructor() {
        this.cache = new Map();
        this.EXPIRE_TIME = 10 * 60 * 1000; // 10 minutes in milliseconds
    }

    /**
     * Store verification code with expiration
     * @param {string} userId - User ID
     * @param {string} code - Verification code
     */
    setCode(userId, code) {
        const expiresAt = Date.now() + this.EXPIRE_TIME;
        this.cache.set(userId, {
            code,
            expiresAt
        });
        
        // Clean up expired entries
        this.cleanup();
    }

    /**
     * Get and validate verification code
     * @param {string} userId - User ID
     * @param {string} code - Verification code to check
     * @returns {boolean} - Whether code is valid
     */
    validateCode(userId, code) {
        const entry = this.cache.get(userId);
        
        if (!entry) {
            return false;
        }

        // Check if expired
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(userId);
            return false;
        }

        // Check if code matches
        if (entry.code === code) {
            this.cache.delete(userId); // Remove after successful validation
            return true;
        }

        return false;
    }

    /**
     * Remove verification code
     * @param {string} userId - User ID
     */
    removeCode(userId) {
        this.cache.delete(userId);
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        for (const [userId, entry] of this.cache.entries()) {
            if (now > entry.expiresAt) {
                this.cache.delete(userId);
            }
        }
    }
}

module.exports = new VerificationCache(); 