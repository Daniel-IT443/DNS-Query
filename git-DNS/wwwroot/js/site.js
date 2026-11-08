(() => {
    const form = document.querySelector('#query-form');
    const input = document.querySelector('#domain-input');
    const button = form.querySelector('button');
    const grid = document.querySelector('#record-grid');
    const loading = document.querySelector('#loading-state');
    const empty = document.querySelector('#empty-state');
    const formError = document.querySelector('#form-error');
    const statusText = document.querySelector('#status-text');
    const status = document.querySelector('#lookup-status');
    const titleDomain = document.querySelector('#results-title span');
    const typeInfo = {
        A: { code: 1, label: 'IPv4 address', note: 'The server this domain points to.' },
        AAAA: { code: 28, label: 'IPv6 address', note: 'The modern, expanded address for this domain.' },
        CNAME: { code: 5, label: 'Canonical name', note: 'An alias pointing to another domain.' },
        MX: { code: 15, label: 'Mail exchange', note: 'A server responsible for receiving email.' },
        NS: { code: 2, label: 'Name server', note: 'A server with authority over this domain.' },
        TXT: { code: 16, label: 'Text record', note: 'Text used for verification and security.' }
    };

    const normalizeDomain = value => value.trim().replace(/^https?:\/\//i, '').split('/')[0].replace(/\.$/, '').toLowerCase();
    const validDomain = value => /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value);
    const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));

    async function lookup(domain, type) {
        const response = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=${type}`, { headers: { accept: 'application/dns-json' } });
        if (!response.ok) throw new Error('DNS service unavailable');
        const data = await response.json();
        return (data.Answer || []).filter(answer => answer.type === typeInfo[type].code).map(answer => ({ value: answer.data, ttl: answer.TTL }));
    }

    function renderRecords(domain, records) {
        grid.innerHTML = records.map(record => `<article class="record-card"><div class="record-card-head"><span class="record-type">${record.type}</span><span class="record-ttl">TTL ${record.ttl}s</span></div><h3>${escapeHtml(record.label)}</h3><p class="record-value">${escapeHtml(record.value)}</p><p class="record-note">${escapeHtml(record.note)}</p></article>`).join('');
        empty.hidden = records.length > 0;
        grid.hidden = records.length === 0;
    }

    async function runLookup() {
        const domain = normalizeDomain(input.value);
        formError.hidden = true;
        if (!validDomain(domain)) {
            formError.textContent = 'Enter a valid domain, like example.com.';
            formError.hidden = false;
            input.focus();
            return;
        }

        input.value = domain;
        titleDomain.textContent = domain;
        grid.innerHTML = '';
        grid.hidden = true;
        empty.hidden = true;
        loading.hidden = false;
        button.disabled = true;
        status.classList.remove('is-error');
        statusText.textContent = 'Querying DNS…';

        try {
            const types = Object.keys(typeInfo);
            const responses = await Promise.all(types.map(type => lookup(domain, type).then(values => ({ type, values }))));
            const records = responses.flatMap(({ type, values }) => values.map(value => ({ ...value, type, label: typeInfo[type].label, note: typeInfo[type].note })));
            renderRecords(domain, records);
            statusText.textContent = `${records.length} record${records.length === 1 ? '' : 's'} found`;
        } catch (error) {
            status.classList.add('is-error');
            statusText.textContent = 'Lookup failed';
            empty.hidden = false;
            grid.hidden = true;
            empty.querySelector('h3').textContent = 'We could not reach DNS';
            empty.querySelector('p').textContent = 'Check your connection and try the lookup again.';
        } finally {
            loading.hidden = true;
            button.disabled = false;
        }
    }

    form.addEventListener('submit', event => { event.preventDefault(); runLookup(); });
    document.querySelector('[data-example]').addEventListener('click', event => { input.value = event.currentTarget.dataset.example; runLookup(); });
    runLookup();
})();