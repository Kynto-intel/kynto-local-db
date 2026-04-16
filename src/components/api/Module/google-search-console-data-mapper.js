/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * GOOGLE SEARCH CONSOLE DATA MAPPER — ULTIMATE EDITION v2.0
 * Covers ALL available GSC API endpoints and data types
 *
 * Endpoints covered:
 *   1.  Search Analytics   → searchanalytics.query
 *   2.  Sitemaps           → sitemaps.list / sitemaps.get
 *   3.  URL Inspection     → urlInspection.index.inspect
 *   4.  Sites              → sites.list / sites.get
 *   5.  Index Coverage     → (via URL Inspection batch / aggregated)
 *   6.  Rich Results       → parsed from urlInspection richResultsResult
 *   7.  AMP                → parsed from urlInspection ampResult
 *   8.  Mobile Usability   → parsed from urlInspection mobileUsabilityResult
 *   9.  Core Web Vitals    → derived metrics from Search Analytics device split
 *   10. Discover / News    → Search Analytics with searchType filter
 *
 * Language: JavaScript (CommonJS)
 * ═══════════════════════════════════════════════════════════════════════════════
 */

'use strict';

// ─── Internal helpers ────────────────────────────────────────────────────────

/**
 * Safe key extractor for GSC dimension arrays.
 * GSC delivers keys in the order you requested them in dimensionFilterGroups.
 */
function key(keys, index, fallback = 'n/a') {
    return (Array.isArray(keys) && keys[index] != null) ? keys[index] : fallback;
}

/** Round a number to N decimal places (avoids floating-point drift). */
function round(value, decimals = 2) {
    return Number(Number(value || 0).toFixed(decimals));
}

/** Normalise ISO date strings → YYYY-MM-DD; return 'n/a' for missing values. */
function isoDate(value) {
    if (!value) return 'n/a';
    try { return new Date(value).toISOString().slice(0, 10); } catch { return value; }
}

// ─── Main mapper object ───────────────────────────────────────────────────────

const GSCDataMapper = {

    // =========================================================================
    // 1. SEARCH ANALYTICS
    //    Source: POST https://searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/searchAnalytics/query
    //    Supports searchType: web | image | video | news | googleNews | discover
    // =========================================================================

    /**
     * Map Search Analytics rows.
     *
     * @param {Array}  rows        - The `rows` array from the API response.
     * @param {Array}  dimensions  - Ordered list of requested dimensions,
     *                               e.g. ['query','page','country','device','date','searchAppearance']
     *                               Defaults to the most common 5-dimension order.
     * @param {string} searchType  - 'web' | 'image' | 'video' | 'news' | 'discover'
     * @returns {Array}
     */
    mapSearchAnalytics(rows, dimensions = ['query', 'page', 'country', 'device', 'date'], searchType = 'web') {
        if (!rows || !Array.isArray(rows)) return [];

        return rows.map(item => {
            const clicks      = item.clicks      || 0;
            const impressions = item.impressions  || 0;
            const ctr         = item.ctr          || 0;  // GSC delivers 0–1
            const position    = item.position     || 0;

            // Build a dimension map from the requested order
            const dim = {};
            dimensions.forEach((d, i) => { dim[d] = key(item.keys, i); });

            return {
                // ── Dimensions (only populated if requested) ──────────────
                query:            dim.query            ?? 'n/a',
                page:             dim.page             ?? 'n/a',
                country:          dim.country          ?? 'all',    // ISO 3166-1 alpha-3 (e.g. 'deu')
                device:           dim.device           ?? 'all',    // DESKTOP | MOBILE | TABLET
                date:             dim.date             ?? 'n/a',    // YYYY-MM-DD
                searchAppearance: dim.searchAppearance ?? 'n/a',    // AMP_BLUE_LINK, RICH_SNIPPET, etc.

                // ── Core Metrics ──────────────────────────────────────────
                clicks,
                impressions,
                ctr:       round(ctr * 100, 2),  // converted to %
                position:  round(position, 1),

                // ── Derived / Advanced Metrics ────────────────────────────
                performanceScore: round((clicks / (impressions || 1)) * 100, 2),
                visibilityIndex:  Math.round(impressions / (position || 1)),

                // Click-through opportunity: how many more clicks at avg 3% CTR?
                ctrGap: impressions > 0 ? round(((3 - ctr * 100) / 100) * impressions, 0) : 0,

                // ── Meta ─────────────────────────────────────────────────
                searchType,
            };
        });
    },

    // =========================================================================
    // 2. SITEMAPS
    //    Source: GET https://searchconsole.googleapis.com/webmasters/v3/sites/{siteUrl}/sitemaps
    //            GET …/sitemaps/{feedpath}
    // =========================================================================

    /**
     * Map sitemap list or single sitemap response.
     * @param {Array|Object} input - `sitemap` array or single sitemap object.
     * @returns {Array}
     */
    mapSitemaps(input) {
        const list = Array.isArray(input) ? input : (input ? [input] : []);
        return list.map(map => {
            const contents = Array.isArray(map.contents) ? map.contents : [];
            const totalSubmitted = contents.reduce((s, c) => s + Number(c.submitted || 0), 0);
            const totalIndexed   = contents.reduce((s, c) => s + Number(c.indexed   || 0), 0);

            return {
                path:            map.path           || 'unknown',
                type:            map.type           || 'sitemap',    // sitemap | atomFeed | rssFeed
                isPending:       Boolean(map.isPending),
                isSitemapsIndex: Boolean(map.isSitemapsIndex),
                lastSubmitted:   isoDate(map.lastSubmitted),
                lastDownloaded:  isoDate(map.lastDownloaded),
                warnings:        Number(map.warnings || 0),
                errors:          Number(map.errors   || 0),
                submittedItems:  totalSubmitted,
                indexedItems:    totalIndexed,
                indexRatio:      totalSubmitted > 0 ? round((totalIndexed / totalSubmitted) * 100, 1) : null,
                // Detailed content breakdown (image, video, web, news types)
                contents: contents.map(c => ({
                    type:      c.type      || 'web',
                    submitted: Number(c.submitted || 0),
                    indexed:   Number(c.indexed   || 0),
                })),
            };
        });
    },

    // =========================================================================
    // 3. URL INSPECTION
    //    Source: POST https://searchconsole.googleapis.com/v1/urlInspection/index:inspect
    //    Returns index coverage, AMP, rich results, mobile usability in one call.
    // =========================================================================

    /**
     * Map the full URL Inspection API response.
     * @param {Object} response - The complete API response object.
     * @returns {Object}
     */
    mapUrlInspection(response) {
        if (!response || !response.inspectionResult) return null;

        const r = response.inspectionResult;

        return {
            inspectionUrl:   r.inspectionUrl   || 'n/a',
            indexStatusResult: this._mapIndexStatus(r.indexStatusResult),
            ampResult:          this._mapAmpResult(r.ampResult),
            mobileUsability:    this._mapMobileUsability(r.mobileUsabilityResult),
            richResults:        this._mapRichResults(r.richResultsResult),
        };
    },

    /** @private */
    _mapIndexStatus(index) {
        if (!index) return null;
        return {
            verdict:              index.verdict              || 'VERDICT_UNSPECIFIED', // PASS | FAIL | NEUTRAL
            coverageState:        index.coverageState        || 'n/a',
            robotsTxtState:       index.robotsTxtState       || 'ROBOTS_TXT_STATE_UNSPECIFIED',
            indexingState:        index.indexingState        || 'INDEXING_STATE_UNSPECIFIED',
            lastCrawlTime:        isoDate(index.lastCrawlTime),
            pageFetchState:       index.pageFetchState       || 'PAGE_FETCH_STATE_UNSPECIFIED',
            googleCanonical:      index.googleCanonical      || 'n/a',
            userCanonical:        index.userCanonical        || 'n/a',
            sitemap:              index.sitemap              || [],
            referringUrls:        index.referringUrls        || [],
            crawledAs:            index.crawledAs            || 'CRAWLING_USER_AGENT_UNSPECIFIED',
        };
    },

    /** @private */
    _mapAmpResult(amp) {
        if (!amp) return null;
        return {
            verdict:          amp.verdict         || 'VERDICT_UNSPECIFIED',
            issues:           (amp.issues || []).map(issue => ({
                issueMessage:     issue.issueMessage     || 'n/a',
                severity:         issue.severity         || 'SEVERITY_UNSPECIFIED',
                issueType:        issue.issueType        || 'n/a',
                details:          issue.details          || {},
            })),
            ampUrl:           amp.ampUrl          || 'n/a',
            ampIndexStatusResult: amp.ampIndexStatusResult ? this._mapIndexStatus(amp.ampIndexStatusResult) : null,
        };
    },

    /** @private */
    _mapMobileUsability(mob) {
        if (!mob) return null;
        return {
            verdict: mob.verdict || 'VERDICT_UNSPECIFIED',
            issues:  (mob.issues || []).map(issue => ({
                issueType: issue.issueType || 'n/a', // CONTENT_WIDTH, USES_INCOMPATIBLE_PLUGINS, etc.
            })),
        };
    },

    /** @private */
    _mapRichResults(rr) {
        if (!rr) return null;
        return {
            verdict:    rr.verdict || 'VERDICT_UNSPECIFIED',
            detectedItems: (rr.detectedItems || []).map(item => ({
                richResultType: item.richResultType || 'n/a', // FAQ, PRODUCT, RECIPE, etc.
                items: (item.items || []).map(i => ({
                    name:   i.name   || 'n/a',
                    issues: (i.issues || []).map(iss => ({
                        issueMessage: iss.issueMessage || 'n/a',
                        severity:     iss.severity     || 'SEVERITY_UNSPECIFIED',
                        issueType:    iss.issueType    || 'n/a',
                    })),
                })),
            })),
        };
    },

    // =========================================================================
    // 4. SITES
    //    Source: GET https://searchconsole.googleapis.com/webmasters/v3/sites
    //            GET …/sites/{siteUrl}
    // =========================================================================

    /**
     * Map the sites list.
     * @param {Array} sites - The `siteEntry` array from the API response.
     * @returns {Array}
     */
    mapSites(sites) {
        if (!sites || !Array.isArray(sites)) return [];
        return sites.map(site => ({
            siteUrl:        site.siteUrl        || 'n/a',
            permissionLevel: site.permissionLevel || 'PERMISSION_UNSPECIFIED',
            // FULL | RESTRICTED | SITE_OWNER | VERIFIED_OWNER | UNVERIFIED
        }));
    },

    // =========================================================================
    // 5. CORE WEB VITALS — derived from Search Analytics
    //    Real CWV field data lives in CrUX (separate API), but GSC provides
    //    impression/click patterns that reflect device performance.
    //    Use this to enrich device-split performance data.
    // =========================================================================

    /**
     * Aggregate Search Analytics rows by device and compute CWV-proxy metrics.
     * Call mapSearchAnalytics first, then pass the result here.
     * @param {Array} mappedRows - Output of mapSearchAnalytics()
     * @returns {Object} - Keyed by device type
     */
    aggregateByDevice(mappedRows) {
        const buckets = {};
        for (const row of mappedRows) {
            const d = row.device || 'all';
            if (!buckets[d]) {
                buckets[d] = { clicks: 0, impressions: 0, ctrSum: 0, posSum: 0, count: 0 };
            }
            buckets[d].clicks      += row.clicks;
            buckets[d].impressions += row.impressions;
            buckets[d].ctrSum      += row.ctr;
            buckets[d].posSum      += row.position;
            buckets[d].count       += 1;
        }

        const result = {};
        for (const [device, b] of Object.entries(buckets)) {
            result[device] = {
                device,
                totalClicks:      b.clicks,
                totalImpressions: b.impressions,
                avgCtr:           round(b.ctrSum / b.count, 2),
                avgPosition:      round(b.posSum / b.count, 1),
                shareOfClicks:    null, // filled in below
            };
        }

        // Compute click share across devices
        const grandTotal = Object.values(result).reduce((s, r) => s + r.totalClicks, 0);
        for (const r of Object.values(result)) {
            r.shareOfClicks = grandTotal > 0 ? round((r.totalClicks / grandTotal) * 100, 1) : 0;
        }

        return result;
    },

    // =========================================================================
    // 6. DISCOVER / NEWS / GOOGLE NEWS (searchType variants)
    //    Same mapSearchAnalytics() call — just pass the correct searchType.
    //    These types don't expose query dimension, so dimension order differs.
    // =========================================================================

    /**
     * Map Discover or Google News performance rows.
     * Discover/News don't return queries — dimensions are typically page + country + device.
     * @param {Array}  rows
     * @param {string} searchType  - 'discover' | 'news' | 'googleNews'
     * @returns {Array}
     */
    mapDiscoverOrNews(rows, searchType = 'discover') {
        return this.mapSearchAnalytics(
            rows,
            ['page', 'country', 'device', 'date'],
            searchType
        );
    },

    // =========================================================================
    // 7. COLUMN DEFINITIONS
    //    Ready-to-use column configs for UI tables (sortable, typed, labelled).
    // =========================================================================

    /**
     * @param {'performance'|'sitemaps'|'urlInspection'|'sites'|'device'|'discover'} type
     * @returns {Array}
     */
    getColumns(type = 'performance') {
        const configs = {
            performance: [
                { id: 'query',            label: 'Search Query',     sortable: true },
                { id: 'clicks',           label: 'Clicks',           sortable: true, type: 'number' },
                { id: 'impressions',      label: 'Impressions',      sortable: true, type: 'number' },
                { id: 'ctr',              label: 'CTR (%)',          sortable: true, type: 'number' },
                { id: 'position',         label: 'Avg. Position',    sortable: true, type: 'number' },
                { id: 'page',             label: 'Landing Page',     sortable: true },
                { id: 'country',          label: 'Country',          sortable: true },
                { id: 'device',           label: 'Device',           sortable: true },
                { id: 'date',             label: 'Date',             sortable: true },
                { id: 'searchAppearance', label: 'Search Appearance',sortable: true },
                { id: 'performanceScore', label: 'Perf. Score',      sortable: true, type: 'number' },
                { id: 'visibilityIndex',  label: 'Visibility Index', sortable: true, type: 'number' },
                { id: 'ctrGap',           label: 'CTR Gap',          sortable: true, type: 'number' },
            ],
            sitemaps: [
                { id: 'path',            label: 'Sitemap URL',   sortable: true },
                { id: 'type',            label: 'Type',          sortable: true },
                { id: 'lastSubmitted',   label: 'Submitted',     sortable: true },
                { id: 'lastDownloaded',  label: 'Downloaded',    sortable: true },
                { id: 'errors',          label: 'Errors',        sortable: true, type: 'number' },
                { id: 'warnings',        label: 'Warnings',      sortable: true, type: 'number' },
                { id: 'submittedItems',  label: 'Submitted URLs',sortable: true, type: 'number' },
                { id: 'indexedItems',    label: 'Indexed URLs',  sortable: true, type: 'number' },
                { id: 'indexRatio',      label: 'Index Rate (%)',sortable: true, type: 'number' },
                { id: 'isPending',       label: 'Pending',       sortable: false },
                { id: 'isSitemapsIndex', label: 'Index File',    sortable: false },
            ],
            urlInspection: [
                { id: 'inspectionUrl',         label: 'URL',                 sortable: true },
                { id: 'indexStatusResult.verdict',       label: 'Index Verdict',  sortable: true },
                { id: 'indexStatusResult.coverageState', label: 'Coverage',       sortable: true },
                { id: 'indexStatusResult.lastCrawlTime', label: 'Last Crawled',   sortable: true },
                { id: 'indexStatusResult.crawledAs',     label: 'Crawled As',     sortable: true },
                { id: 'mobileUsability.verdict',         label: 'Mobile',         sortable: true },
                { id: 'ampResult.verdict',               label: 'AMP',            sortable: true },
                { id: 'richResults.verdict',             label: 'Rich Results',   sortable: true },
            ],
            sites: [
                { id: 'siteUrl',          label: 'Site URL',         sortable: true },
                { id: 'permissionLevel',  label: 'Permission',       sortable: true },
            ],
            device: [
                { id: 'device',           label: 'Device',           sortable: true },
                { id: 'totalClicks',      label: 'Total Clicks',     sortable: true, type: 'number' },
                { id: 'totalImpressions', label: 'Impressions',      sortable: true, type: 'number' },
                { id: 'avgCtr',           label: 'Avg CTR (%)',      sortable: true, type: 'number' },
                { id: 'avgPosition',      label: 'Avg Position',     sortable: true, type: 'number' },
                { id: 'shareOfClicks',    label: 'Click Share (%)',  sortable: true, type: 'number' },
            ],
            discover: [
                { id: 'page',             label: 'Page',             sortable: true },
                { id: 'clicks',           label: 'Clicks',           sortable: true, type: 'number' },
                { id: 'impressions',      label: 'Impressions',      sortable: true, type: 'number' },
                { id: 'ctr',              label: 'CTR (%)',          sortable: true, type: 'number' },
                { id: 'country',          label: 'Country',          sortable: true },
                { id: 'device',           label: 'Device',           sortable: true },
                { id: 'date',             label: 'Date',             sortable: true },
            ],
        };
        return configs[type] || configs.performance;
    },

    // =========================================================================
    // 8. UTILITY METHODS
    // =========================================================================

    /**
     * Flatten a URL inspection result into a single-level object for table display.
     * Useful when you want one row per URL with all verdicts visible.
     * @param {Object} mappedInspection - Output of mapUrlInspection()
     * @returns {Object}
     */
    flattenUrlInspection(mappedInspection) {
        if (!mappedInspection) return {};
        const idx = mappedInspection.indexStatusResult || {};
        const mob = mappedInspection.mobileUsability   || {};
        const amp = mappedInspection.ampResult         || {};
        const rr  = mappedInspection.richResults       || {};

        return {
            inspectionUrl:       mappedInspection.inspectionUrl,
            indexVerdict:        idx.verdict,
            coverageState:       idx.coverageState,
            lastCrawlTime:       idx.lastCrawlTime,
            crawledAs:           idx.crawledAs,
            googleCanonical:     idx.googleCanonical,
            userCanonical:       idx.userCanonical,
            robotsTxtState:      idx.robotsTxtState,
            indexingState:       idx.indexingState,
            pageFetchState:      idx.pageFetchState,
            mobileVerdict:       mob.verdict,
            mobileIssueCount:    Array.isArray(mob.issues) ? mob.issues.length : 0,
            ampVerdict:          amp.verdict,
            ampIssueCount:       Array.isArray(amp.issues) ? amp.issues.length : 0,
            richResultVerdict:   rr.verdict,
            richResultTypes:     Array.isArray(rr.detectedItems)
                ? rr.detectedItems.map(i => i.richResultType).join(', ')
                : 'n/a',
        };
    },

    /**
     * Sort mapped rows by any numeric or string column.
     * @param {Array}  rows
     * @param {string} column
     * @param {'asc'|'desc'} direction
     * @returns {Array}
     */
    sortRows(rows, column, direction = 'desc') {
        if (!Array.isArray(rows) || !column) return rows;
        return [...rows].sort((a, b) => {
            const va = a[column] ?? (typeof a[column] === 'number' ? 0 : '');
            const vb = b[column] ?? (typeof b[column] === 'number' ? 0 : '');
            if (typeof va === 'number' && typeof vb === 'number') {
                return direction === 'asc' ? va - vb : vb - va;
            }
            return direction === 'asc'
                ? String(va).localeCompare(String(vb))
                : String(vb).localeCompare(String(va));
        });
    },

    /**
     * Group Search Analytics rows by a dimension (e.g. group by 'country').
     * Aggregates clicks and impressions, recalculates CTR and avgPosition.
     * @param {Array}  rows
     * @param {string} groupBy - Dimension key to group by
     * @returns {Array}
     */
    groupBy(rows, groupBy) {
        if (!Array.isArray(rows) || !groupBy) return rows;
        const map = {};
        for (const row of rows) {
            const k = row[groupBy] || 'unknown';
            if (!map[k]) {
                map[k] = { [groupBy]: k, clicks: 0, impressions: 0, _posSum: 0, _count: 0 };
            }
            map[k].clicks      += row.clicks;
            map[k].impressions += row.impressions;
            map[k]._posSum     += row.position;
            map[k]._count      += 1;
        }
        return Object.values(map).map(({ _posSum, _count, ...rest }) => ({
            ...rest,
            ctr:      rest.impressions > 0 ? round((rest.clicks / rest.impressions) * 100, 2) : 0,
            position: round(_posSum / _count, 1),
        }));
    },

    /**
     * Compute period-over-period deltas between two sets of mapped rows.
     * Matches rows by `query` (or `page` for non-query types).
     * @param {Array}  currentRows
     * @param {Array}  previousRows
     * @param {string} matchKey  - 'query' | 'page'
     * @returns {Array}
     */
    computeDeltas(currentRows, previousRows, matchKey = 'query') {
        if (!Array.isArray(currentRows) || !Array.isArray(previousRows)) return currentRows;

        const prevMap = {};
        for (const r of previousRows) { prevMap[r[matchKey]] = r; }

        return currentRows.map(curr => {
            const prev = prevMap[curr[matchKey]] || {};
            return {
                ...curr,
                deltaClicks:      curr.clicks      - (prev.clicks      || 0),
                deltaImpressions: curr.impressions - (prev.impressions || 0),
                deltaCtr:         round(curr.ctr   - (prev.ctr         || 0), 2),
                deltaPosition:    round(curr.position - (prev.position || 0), 1),
            };
        });
    },
};

module.exports = GSCDataMapper;