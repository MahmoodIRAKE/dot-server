const WORK_KEYS = ['description', 'height', 'width', 'jobRef', 'notes'];

function emptyWork() {
    return {
        description: '',
        height: '',
        width: '',
        jobRef: '',
        notes: ''
    };
}

function sanitizeWork(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return emptyWork();
    }
    const work = {
        description: raw.description != null ? String(raw.description) : '',
        height: raw.height != null ? String(raw.height) : '',
        width: raw.width != null ? String(raw.width) : '',
        jobRef: raw.jobRef != null ? String(raw.jobRef) : '',
        notes: raw.notes != null ? String(raw.notes) : ''
    };
    if (raw._id) {
        work._id = raw._id;
    }
    return work;
}

function getOrderWorks(order) {
    if (!order) return [emptyWork()];
    const list = order.works;
    if (Array.isArray(list) && list.length > 0) {
        return list.map(sanitizeWork);
    }
    return [sanitizeWork(order)];
}

function applyWorksFromBody(body, { syncNotesFromFirstWork = false } = {}) {
    const result = {};
    if (!body || !Array.isArray(body.works)) {
        if (body && body.notes !== undefined) {
            result.notes = body.notes;
        }
        return result;
    }

    const works = body.works.map(sanitizeWork);
    result.works = works.length > 0 ? works : [emptyWork()];
    const first = result.works[0];
    result.description = first.description;
    result.height = first.height;
    result.width = first.width;
    result.jobRef = first.jobRef;
    if (body.notes !== undefined) {
        result.notes = body.notes;
    } else if (syncNotesFromFirstWork) {
        result.notes = first.notes;
    }
    return result;
}

function syncWorksOnUpdate(existingOrder, updateData) {
    if (!updateData || updateData.works) return updateData;
    const existingWorks = existingOrder && existingOrder.works;
    if (!Array.isArray(existingWorks) || existingWorks.length === 0) {
        return updateData;
    }
    const touchesWork = WORK_KEYS.some((key) => updateData[key] !== undefined);
    if (!touchesWork) return updateData;

    const works = getOrderWorks(existingOrder);
    const first = { ...works[0] };
    for (const key of WORK_KEYS) {
        if (updateData[key] !== undefined) {
            first[key] = updateData[key] != null ? String(updateData[key]) : '';
        }
    }
    works[0] = first;
    return { ...updateData, works };
}

function formatWorksText(order) {
    const works = getOrderWorks(order);
    return works
        .map((work, index) => {
            const lines = [];
            if (works.length > 1) {
                lines.push(`עבודה ${index + 1}`);
            }
            if (work.jobRef) lines.push(`מספר עבודה: ${work.jobRef}`);
            if (work.width || work.height) {
                lines.push(`מידות: ${work.width || '—'} × ${work.height || '—'}`);
            }
            if (work.description) lines.push(work.description);
            if (work.notes) lines.push(`הערות: ${work.notes}`);
            return lines.join('\n');
        })
        .filter(Boolean)
        .join('\n\n');
}

module.exports = {
    WORK_KEYS,
    emptyWork,
    sanitizeWork,
    getOrderWorks,
    applyWorksFromBody,
    syncWorksOnUpdate,
    formatWorksText
};
