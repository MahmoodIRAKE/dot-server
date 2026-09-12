const Order = require('../models/Order');

const ORDER_STATUSES = [
    'new',
    'waiting for approval',
    'in progress',
    'paymentR',
    'DONE',
    'delayed',
    'declined'
];

const PERIODS = ['month', '3months', '6months', 'year', 'all'];
const TIME_ZONE = 'Asia/Jerusalem';

function invalidPeriodError(period) {
    const err = new Error('Invalid statistics period');
    err.status = 400;
    err.period = period;
    return err;
}

function tzOffsetMs(utcMs, timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(new Date(utcMs));
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    const asIfUtc = Date.UTC(
        get('year'),
        get('month') - 1,
        get('day'),
        get('hour'),
        get('minute'),
        get('second')
    );
    return asIfUtc - utcMs;
}

function zonedTimeToUtc(year, month, day, hour = 0, minute = 0) {
    const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
    return new Date(guess - tzOffsetMs(guess, TIME_ZONE));
}

function getZonedParts(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: TIME_ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const get = (type) => Number(parts.find((p) => p.type === type).value);
    return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hour: get('hour'),
        minute: get('minute')
    };
}

function daysInMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addMonths(parts, delta) {
    let year = parts.year;
    let month = parts.month + delta;
    while (month <= 0) {
        month += 12;
        year -= 1;
    }
    while (month > 12) {
        month -= 12;
        year += 1;
    }
    const day = Math.min(parts.day, daysInMonth(year, month));
    return { ...parts, year, month, day };
}

function resolveDateRange(period, now = new Date()) {
    if (!PERIODS.includes(period)) {
        throw invalidPeriodError(period);
    }

    const to = now;
    const parts = getZonedParts(now);

    if (period === 'all') {
        return { period, from: null, to, previousFrom: null, previousTo: null };
    }

    if (period === 'month') {
        const from = zonedTimeToUtc(parts.year, parts.month, 1, 0, 0);
        const prevStartParts = addMonths({ ...parts, day: 1 }, -1);
        const previousFrom = zonedTimeToUtc(prevStartParts.year, prevStartParts.month, 1, 0, 0);
        return { period, from, to, previousFrom, previousTo: from };
    }

    const months = period === '3months' ? 3 : period === '6months' ? 6 : 12;
    const fromParts = addMonths(parts, -months);
    const from = zonedTimeToUtc(
        fromParts.year,
        fromParts.month,
        fromParts.day,
        fromParts.hour,
        fromParts.minute
    );
    const prevParts = addMonths(fromParts, -months);
    const previousFrom = zonedTimeToUtc(
        prevParts.year,
        prevParts.month,
        prevParts.day,
        prevParts.hour,
        prevParts.minute
    );
    return { period, from, to, previousFrom, previousTo: from };
}

function createdAtMatch(from, to) {
    const createdAt = { $lte: to };
    if (from) createdAt.$gte = from;
    return { createdAt };
}

function fillStatusCounts(rows) {
    const byStatus = new Map(rows.map((row) => [row._id, row.count]));
    return ORDER_STATUSES.map((status) => ({
        status,
        count: byStatus.get(status) || 0
    }));
}

function fillMonthlySeries(rows, from, to) {
    const map = new Map(rows.map((row) => [row._id, row.count]));
    if (!from) {
        return rows
            .slice()
            .sort((a, b) => a._id.localeCompare(b._id))
            .map((row) => ({
                yearMonth: row._id,
                count: row.count
            }));
    }

    const start = getZonedParts(from);
    const end = getZonedParts(to);
    const series = [];
    let year = start.year;
    let month = start.month;
    while (year < end.year || (year === end.year && month <= end.month)) {
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        series.push({
            yearMonth,
            count: map.get(yearMonth) || 0
        });
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return series;
}

function msToDays(ms) {
    if (ms == null || Number.isNaN(ms)) return null;
    return Math.round((ms / (24 * 60 * 60 * 1000)) * 10) / 10;
}

async function aggregateByStatus(OrderModel, from, to) {
    const rows = await OrderModel.aggregate([
        { $match: createdAtMatch(from, to) },
        { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    return fillStatusCounts(rows);
}

async function aggregateOverTime(OrderModel, from, to) {
    const rows = await OrderModel.aggregate([
        { $match: createdAtMatch(from, to) },
        {
            $group: {
                _id: {
                    $dateToString: {
                        format: '%Y-%m',
                        date: '$createdAt',
                        timezone: TIME_ZONE
                    }
                },
                count: { $sum: 1 }
            }
        },
        { $sort: { _id: 1 } }
    ]);
    return fillMonthlySeries(rows, from, to);
}

async function aggregateCompletion(OrderModel, from, to) {
    const match = {
        status: 'DONE',
        ...createdAtMatch(from, to)
    };

    const rows = await OrderModel.aggregate([
        { $match: match },
        {
            $lookup: {
                from: 'order_change_logs',
                let: { orderId: '$_id' },
                pipeline: [
                    {
                        $match: {
                            $expr: {
                                $and: [
                                    { $eq: ['$orderId', '$$orderId'] },
                                    { $eq: ['$fieldName', 'status'] },
                                    { $eq: ['$newValue', 'DONE'] }
                                ]
                            }
                        }
                    },
                    { $sort: { createdAt: 1 } },
                    { $limit: 1 },
                    { $project: { createdAt: 1 } }
                ],
                as: 'doneLog'
            }
        },
        {
            $addFields: {
                completedAt: {
                    $ifNull: [{ $arrayElemAt: ['$doneLog.createdAt', 0] }, '$updatedAt']
                }
            }
        },
        {
            $group: {
                _id: null,
                count: { $sum: 1 },
                avgMs: { $avg: { $subtract: ['$completedAt', '$createdAt'] } }
            }
        }
    ]);

    const row = rows[0];
    return {
        completedCount: row ? row.count : 0,
        averageDays: row ? msToDays(row.avgMs) : null
    };
}

async function getOrderStatistics(period = 'month', deps = {}) {
    const range = resolveDateRange(period);
    const OrderModel = deps.Order || Order;

    const [byStatus, overTime, completion] = await Promise.all([
        aggregateByStatus(OrderModel, range.from, range.to),
        aggregateOverTime(OrderModel, range.from, range.to),
        aggregateCompletion(OrderModel, range.from, range.to)
    ]);

    let previousCompletion = null;
    if (range.previousFrom) {
        previousCompletion = await aggregateCompletion(
            OrderModel,
            range.previousFrom,
            range.previousTo
        );
    }

    const averageDays = completion.averageDays;
    const previousAverageDays = previousCompletion ? previousCompletion.averageDays : null;
    const changeDays =
        averageDays != null && previousAverageDays != null
            ? Math.round((averageDays - previousAverageDays) * 10) / 10
            : null;

    return {
        period: range.period,
        range: {
            from: range.from ? range.from.toISOString() : null,
            to: range.to.toISOString()
        },
        byStatus,
        overTime,
        completion: {
            completedCount: completion.completedCount,
            averageDays,
            previousAverageDays,
            changeDays
        }
    };
}

module.exports = {
    ORDER_STATUSES,
    PERIODS,
    TIME_ZONE,
    resolveDateRange,
    fillStatusCounts,
    fillMonthlySeries,
    msToDays,
    getOrderStatistics
};
