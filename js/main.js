// --- State Management ---
let currentFlow = null;
let currentStep = null;
let chartInstance = null;

let selectedKid = {
    name: '???',
    avatar: '❓'
};

let selectedKidAge = 13;
const FINAL_AGE = 65;

const defaultKidAvatar = {
    Fionoa: '🦊',
    Dhruv: '🐯',
    Kate: '🦉',
    Taylor: '🐺',
    Mehr: '🐼'
};

// Character Journey State (Alex)
const charState = {
    pmt: 0,
    assetClass: 'none', // 'none' (0%), 'cash' (2%) vs 'sp500' (8%)
    fee: 0.05, // 0.05% vs 1.5%
    portfolio: 'index', // 'index' (S&P), 'mixed' (50/50), 'concentrated' (Enron)
};

// Concept Sandbox State
const conceptState = {
    pmt: 500,
    rate: 8,
    fee: 1.5,
    companies: 1, // number of companies in portfolio
    companyOutcomePct: -100, // outcome of one company at shock year
    startAge: 20
};

// Formatter
const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

// --- Math Helpers ---
function calcCompoundPath(p, pmt, rate, fee, startAge, endAge, crashAge = null, crashPct = 0) {
    const years = endAge - startAge;
    const r = (rate - fee) / 100;
    const data = [];
    let current = p;
    
    for(let i=0; i<=years; i++) {
        if(i === 0) {
            data.push(current);
        } else {
            // Apply crash if this is the crash year
            if (crashAge !== null && (startAge + i) === crashAge) {
                current = current * (1 - crashPct);
            } else {
                current = current * (1 + r) + (pmt * 12);
            }
            data.push(current);
        }
    }
    return data;
}

// --- UI Scoreboard Helpers ---
function updateScoreboard(visible, mainTitle='', mainValue=0, mainColor='text-green-400', showCompare=false, compareTitle='', compareValue=0, compareColor='text-red-400') {
    const sb = document.getElementById('viz-scoreboard');
    if (!sb) return;

    if (!visible) {
        sb.classList.add('hidden');
        return;
    }
    
    sb.classList.remove('hidden');

    // Main Value
    document.getElementById('sb-title').innerText = mainTitle;
    const valEl = document.getElementById('sb-value');
    valEl.innerText = usd.format(mainValue);
    const mainAutoColor = mainValue > 0 ? 'text-green-400' : (mainValue < 0 ? 'text-red-400' : 'text-gray-300');
    valEl.className = `text-4xl md:text-5xl font-extrabold font-mono transition-colors duration-500 ${mainAutoColor}`;

    // Comparison Value
    const compBox = document.getElementById('sb-compare');
    if (showCompare) {
        compBox.classList.remove('hidden', 'opacity-0');
        compBox.classList.add('opacity-100');
        document.getElementById('sb-compare-title').innerText = compareTitle;
        const compEl = document.getElementById('sb-compare-value');
        compEl.innerText = usd.format(compareValue);
        const compareAutoColor = compareValue > 0 ? 'text-green-400' : (compareValue < 0 ? 'text-red-400' : 'text-gray-300');
        compEl.className = `text-2xl md:text-3xl font-bold font-mono transition-colors duration-500 ${compareAutoColor}`;
    } else {
        compBox.classList.remove('opacity-100');
        compBox.classList.add('opacity-0', 'hidden');
    }
}

function setConceptOutcome(outcomePct, buttonEl = null) {
    conceptState.companyOutcomePct = outcomePct;
    if (buttonEl) {
        document.querySelectorAll('.btn-outcome').forEach(el => el.classList.remove('selected', 'selected-red', 'selected-green'));
        if (outcomePct >= 0) {
            buttonEl.classList.add('selected-green');
        } else {
            buttonEl.classList.add('selected-red');
        }
    }

    const impact = (conceptState.companyOutcomePct / conceptState.companies);
    const sign = impact > 0 ? '+' : '';
    const damageEl = document.getElementById('s4-damage-val');
    if (damageEl) {
        damageEl.innerText = sign + impact.toFixed(1).replace('.0', '') + '%';
        damageEl.className = impact > 0 ? 'text-3xl font-extrabold text-green-600' : (impact < 0 ? 'text-3xl font-extrabold text-red-600' : 'text-3xl font-extrabold text-gray-600');
    }

    updateConceptChart();
}

// --- Initialization ---
function startFlow(flowType) {
    document.getElementById('landing-page').style.display = 'none';
    document.getElementById('app-container').classList.remove('hidden');
    
    currentFlow = flowType;
    
    // Hide all flows first
    document.getElementById('flow-character').style.display = 'none';
    document.getElementById('flow-concept').style.display = 'none';
    
    const handout = document.getElementById('flow-handout');
    if (handout) handout.style.display = 'none';
    
    const vizContainer = document.getElementById('sticky-viz-container');
    if (vizContainer) {
        if (flowType === 'handout') {
            vizContainer.classList.remove('lg:block');
            vizContainer.classList.add('hidden');
        } else {
            vizContainer.classList.add('lg:block');
        }
    }
    
    if(flowType === 'character') {
        document.getElementById('flow-title').innerText = `The Journey of ${selectedKid.name}`;
        const avatar = document.getElementById('flow-avatar');
        if (avatar) {
            avatar.classList.remove('hidden');
            avatar.classList.add('flex');
            avatar.innerText = selectedKid.avatar;
        }
        document.getElementById('flow-character').style.display = 'block';
        setupIntersectionObserver('flow-character');
        initChart();
        updateCharacterChart(); // Initial render
    } else if(flowType === 'concept') {
        document.getElementById('flow-title').innerText = "The Concept Sandbox";
        const avatar = document.getElementById('flow-avatar');
        if (avatar) {
            avatar.classList.add('hidden');
            avatar.classList.remove('flex');
        }
        document.getElementById('flow-concept').style.display = 'block';
        setupIntersectionObserver('flow-concept');
        initChart(); // Start with timeseries
        updateConceptChart(); // Initial render
    } else if(flowType === 'handout') {
        document.getElementById('flow-title').innerText = "Printable Study Guide";
        const avatar = document.getElementById('flow-avatar');
        if (avatar) {
            avatar.classList.add('hidden');
            avatar.classList.remove('flex');
        }
        if (handout) handout.style.display = 'block';
    }
    
    window.scrollTo(0,0);
}

function selectKidName(name, buttonEl = null) {
    selectedKid.name = name;
    if (selectedKid.avatar === '❓' || !selectedKid.avatar) {
        selectedKid.avatar = defaultKidAvatar[name] || '🙂';
    }

    if (buttonEl) {
        document.querySelectorAll('.name-option').forEach(el => el.classList.remove('selected', 'selected-green', 'selected-red'));
        buttonEl.classList.add('selected');
    }

    document.querySelectorAll('[data-char-name]').forEach(el => {
        el.textContent = selectedKid.name;
    });

    const cardTitle = document.getElementById('journey-card-title');
    if (cardTitle) {
        cardTitle.innerText = `The Journey of ${selectedKid.name}`;
    }

    const navAvatar = document.getElementById('flow-avatar');
    if (navAvatar && selectedKid.avatar) {
        navAvatar.innerText = selectedKid.avatar;
    }

}

function selectKidAvatar(avatar, buttonEl = null) {
    selectedKid.avatar = avatar;

    if (buttonEl) {
        document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected', 'selected-green', 'selected-red'));
        buttonEl.classList.add('selected-green');
    }

    const navAvatar = document.getElementById('flow-avatar');
    if (navAvatar) {
        navAvatar.innerText = selectedKid.avatar;
    }

}

function setKidAge(ageInput) {
    const parsed = parseInt(ageInput, 10);
    if (Number.isNaN(parsed)) return;

    const age = Math.max(0, Math.min(18, parsed));
    selectedKidAge = age;

    const ageInputEl = document.getElementById('kid-age-input');
    if (ageInputEl && String(ageInputEl.value) !== String(age)) {
        ageInputEl.value = age;
    }

    const startTokens = ['journey-age-start', 'story-age-start'];
    startTokens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerText = String(age);
    });

    const subtitle = document.getElementById('journey-card-subtitle');
    if (subtitle) {
        subtitle.innerText = `Follow one person's life from age ${age} to age ${FINAL_AGE}. Make interactive financial choices and watch the consequences compound over decades.`;
    }
}

// --- UI Interaction Handlers (Character) ---
function setCharInput(key, value, buttonEl = null, groupClass = null) {
    charState[key] = value;
    
    if (buttonEl && groupClass) {
        document.querySelectorAll(`.${groupClass}`).forEach(el => el.classList.remove('selected', 'selected-red', 'selected-green'));
        if(value === 'none' || value === 'cash' || value === 'active' || value === 'concentrated') {
            buttonEl.classList.add('selected-red');
        } else if(value === 'sp500' || value === 'passive' || value === 'index') {
            buttonEl.classList.add('selected-green');
        } else {
            buttonEl.classList.add('selected');
        }
    }
    
    updateCharacterChart();
}

document.addEventListener('DOMContentLoaded', () => {
    // Character Sliders
    const c1Savings = document.getElementById('c1-savings');
    if(c1Savings) {
        c1Savings.addEventListener('input', (e) => {
            charState.pmt = parseInt(e.target.value);
            document.getElementById('c1-savings-val').innerText = usd.format(charState.pmt);
            updateCharacterChart();
        });
    }

    // Concept Sliders
    const s1Pmt = document.getElementById('s1-pmt');
    const s1Rate = document.getElementById('s1-rate');
    const s2Age = document.getElementById('s2-age');
    const s3Fee = document.getElementById('s3-fee');
    const s4Companies = document.getElementById('s4-companies');

    if(s1Pmt) s1Pmt.addEventListener('input', (e) => { conceptState.pmt = parseInt(e.target.value); document.getElementById('s1-pmt-val').innerText = usd.format(conceptState.pmt); updateConceptChart(); });
    if(s1Rate) s1Rate.addEventListener('input', (e) => { conceptState.rate = parseInt(e.target.value); document.getElementById('s1-rate-val').innerText = conceptState.rate + '%'; updateConceptChart(); });
    if(s2Age) s2Age.addEventListener('input', (e) => { conceptState.startAge = parseInt(e.target.value); document.getElementById('s2-age-val').innerText = 'Age ' + conceptState.startAge; updateConceptChart(); });
    if(s3Fee) s3Fee.addEventListener('input', (e) => { conceptState.fee = parseFloat(e.target.value); document.getElementById('s3-fee-val').innerText = conceptState.fee.toFixed(2) + '%'; updateConceptChart(); });
    if(s4Companies) s4Companies.addEventListener('input', (e) => { 
        conceptState.companies = parseInt(e.target.value); 
        document.getElementById('s4-companies-val').innerText = conceptState.companies + (conceptState.companies === 1 ? ' Company' : ' Companies'); 
        const impact = (conceptState.companyOutcomePct / conceptState.companies);
        const sign = impact > 0 ? '+' : '';
        document.getElementById('s4-damage-val').innerText = sign + impact.toFixed(1).replace('.0', '') + '%';
        document.getElementById('s4-damage-val').className = impact > 0 ? 'text-3xl font-extrabold text-green-600' : (impact < 0 ? 'text-3xl font-extrabold text-red-600' : 'text-3xl font-extrabold text-gray-600');
        updateConceptChart(); 
    });
});


// --- Scrollytelling Logic (Intersection Observer) ---
function setupIntersectionObserver(containerId) {
    const steps = document.querySelectorAll(`#${containerId} .step`);
    
    const observerOptions = {
        root: null,
        rootMargin: '-50% 0px -50% 0px', // Trigger exactly in the middle of the screen
        threshold: 0
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                steps.forEach(s => s.classList.remove('is-active'));
                entry.target.classList.add('is-active');
                
                const stepId = entry.target.getAttribute('data-step');
                if(currentStep !== stepId) {
                    currentStep = stepId;
                    if(currentFlow === 'character') updateCharacterChart();
                    if(currentFlow === 'concept') updateConceptChart();
                }
            }
        });
    }, observerOptions);

    steps.forEach(step => observer.observe(step));
}

// --- Chart Generation ---
function initChart() {
    if(chartInstance) {
        chartInstance.destroy();
    }

    const ctx = document.getElementById('mainChart').getContext('2d');
    Chart.defaults.font.family = "'Inter', sans-serif";
    
    const config = {
        type: 'line',
        data: { labels: [], datasets: [] },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            scales: {
                x: {
                    title: { display: true, text: 'Timeline' },
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: 'Wealth ($)' },
                    ticks: {
                        callback: function(val) {
                            if (val >= 1000000) return '$' + (val / 1000000).toFixed(1) + 'M';
                            if (val >= 1000) return '$' + (val / 1000).toFixed(0) + 'k';
                            return '$' + val;
                        }
                    }
                }
            },
            plugins: {
                legend: { position: 'bottom' },
                annotation: { annotations: {} },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += usd.format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            }
        }
    };
    chartInstance = new Chart(ctx, config);
}

// --- Flow 1: Character Logic ---
function updateCharacterChart() {
    if(!chartInstance) return;

    const startAge = selectedKidAge;
    const years = FINAL_AGE - startAge;
    const labels = Array.from({length: years + 1}, (_, i) => `Age ${startAge + i}`);
    const crashAge = Math.max(startAge + 1, 45);

    // Calculate different paths
    const rate = charState.assetClass === 'sp500' ? 8 : (charState.assetClass === 'cash' ? 2 : 0);
    const fee = charState.fee;
    const pmt = charState.pmt;
    
    // Baseline: Cash Contributed
    const dataContrib = calcCompoundPath(0, pmt, 0, 0, startAge, FINAL_AGE);
    // Ideal Path: S&P, no bad fees, no crash
    const dataIdeal = calcCompoundPath(0, pmt, 8, 0.05, startAge, FINAL_AGE);
    // Current Path up to the crash point
    let dataCurrent = calcCompoundPath(0, pmt, rate, fee, startAge, FINAL_AGE);

    chartInstance.data.labels = labels;

    // Reset annotations
    chartInstance.options.plugins.annotation.annotations = {};

    if(currentStep === 'c1') {
        // Just show savings growing linearly
        updateScoreboard(true, `Final Wealth at Age ${FINAL_AGE}`, dataContrib[years], '', false);
        chartInstance.data.datasets = [
            { label: 'Total Cash Saved', data: dataContrib, borderColor: '#9ca3af', backgroundColor: 'rgba(156, 163, 175, 0.1)', fill: true, tension: 0 }
        ];
    } 
    else if (currentStep === 'c2') {
        // Introduce Return Rates (Cash vs S&P)
        updateScoreboard(true, 'Wealth at Age 65', dataCurrent[years], charState.assetClass === 'sp500' ? 'text-green-400' : 'text-red-400', 
            true, 'Cash Contributed', dataContrib[years], 'text-gray-400');

        chartInstance.data.datasets = [
            { label: 'Total Cash Saved', data: dataContrib, borderColor: '#d1d5db', borderDash: [5,5], fill: false, tension: 0 },
            { label: charState.assetClass === 'sp500' ? 'S&P 500 (8%)' : (charState.assetClass === 'cash' ? 'Bank Account (2%)' : 'No Investment (0%)'), data: dataCurrent, borderColor: charState.assetClass === 'sp500' ? '#22c55e' : '#ef4444', backgroundColor: charState.assetClass === 'sp500' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
        ];
    }
    else if (currentStep === 'c3') {
        // Introduce Fees (Assuming S&P 500 at 8%)
        // We ALWAYS show both the "Ideal" (0.05%) and the "Active" (1.5%) line so the gap is obvious.
        // We highlight the one the user selected.
        const dataActive = calcCompoundPath(0, pmt, 8, 1.5, startAge, FINAL_AGE);
        const dataPassive = calcCompoundPath(0, pmt, 8, 0.05, startAge, FINAL_AGE);

        const isActiveSelected = charState.fee === 1.5;
        const wealthLost = dataPassive[years] - dataActive[years];

        updateScoreboard(
            true,
            'Final Wealth',
            isActiveSelected ? dataActive[years] : dataPassive[years],
            isActiveSelected ? 'text-red-400' : 'text-green-400',
            isActiveSelected,
            'Lost To Wall Street',
            -wealthLost,
            'text-red-500'
        );

        chartInstance.data.datasets = [
            { 
                label: 'Passive Index (0.05% fee)', 
                data: dataPassive, 
                borderColor: isActiveSelected ? '#86efac' : '#22c55e', // Dim if not selected
                backgroundColor: isActiveSelected ? 'transparent' : 'rgba(34, 197, 94, 0.15)', 
                borderWidth: isActiveSelected ? 2 : 4,
                borderDash: isActiveSelected ? [5,5] : [],
                fill: !isActiveSelected, 
                tension: 0.4 
            },
            { 
                label: 'Active Manager (1.50% fee)', 
                data: dataActive, 
                borderColor: isActiveSelected ? '#ef4444' : '#fca5a5', // Bright red if selected
                backgroundColor: isActiveSelected ? 'rgba(239, 68, 68, 0.15)' : 'transparent', 
                borderWidth: isActiveSelected ? 4 : 2,
                borderDash: isActiveSelected ? [] : [5,5],
                fill: isActiveSelected, 
                tension: 0.4 
            }
        ];
        
        // Cleaner fee annotation: arrow at final year with compact label
        const endLabel = `Age ${FINAL_AGE}`;
        chartInstance.options.plugins.annotation.annotations = isActiveSelected
            ? {
                feeArrow: {
                    type: 'line',
                    xMin: endLabel,
                    xMax: endLabel,
                    yMin: dataActive[years],
                    yMax: dataPassive[years],
                    borderColor: 'rgba(239, 68, 68, 0.75)',
                    borderWidth: 3,
                    borderDash: [3, 3],
                    label: {
                        display: true,
                        content: `Lost to fees: ${usd.format(wealthLost)}`,
                        position: 'start',
                        yAdjust: -8,
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        color: '#b91c1c',
                        borderColor: '#fecaca',
                        borderWidth: 1,
                        padding: 6,
                        font: { weight: 'bold', size: 12 }
                    }
                },
                feePointTop: {
                    type: 'point',
                    xValue: endLabel,
                    yValue: dataPassive[years],
                    backgroundColor: '#22c55e',
                    radius: 4
                },
                feePointBottom: {
                    type: 'point',
                    xValue: endLabel,
                    yValue: dataActive[years],
                    backgroundColor: '#ef4444',
                    radius: 4
                }
            }
            : {};
    }
    else if (currentStep === 'c4' || currentStep === 'c5' || currentStep === 'c6') {
        // Diversification and Crash
        let crashPct = 0;
        if (charState.portfolio === 'index') crashPct = 0.40; // 2008 S&P drop
        if (charState.portfolio === 'mixed') crashPct = 0.70; // 50/50 blend drop
        if (charState.portfolio === 'concentrated') crashPct = 0.99; // Enron/Tech bubble wipeout

        // If c4, we don't crash YET, we just show the line up to age 45.
        // If c5, we crash at 45 and show the immediate drop.
        // If c6, we show the recovery to 65.
        
        let crashData = calcCompoundPath(0, pmt, 8, charState.fee, startAge, FINAL_AGE, crashAge, crashPct);
        
        // Hide future data based on step
        if (currentStep === 'c4') {
            crashData = crashData.map((v, i) => i <= (crashAge - startAge) ? v : null); // Cut off before crash
        } else if (currentStep === 'c5') {
            crashData = crashData.map((v, i) => i <= (crashAge - startAge + 1) ? v : null); // Cut off immediately after crash
        }

        // Always show the ideal "No Crash / Diversified" path as a ghost line for comparison if c5/c6
        const datasets = [];
        let ghostData = calcCompoundPath(0, pmt, 8, charState.fee, startAge, FINAL_AGE, crashAge, 0.40); // Standard market drop
        if (currentStep !== 'c4') {
            if (currentStep === 'c5') ghostData = ghostData.map((v, i) => i <= (crashAge - startAge + 1) ? v : null);
            
            datasets.push({
                label: 'Market Baseline (Diversified)', data: ghostData, borderColor: '#d1d5db', borderDash: [5,5], fill: false, tension: 0.4
            });
        }

        datasets.push({
            label: `Alex's Portfolio (${charState.portfolio})`, 
            data: crashData, 
            borderColor: charState.portfolio === 'concentrated' ? '#ef4444' : (charState.portfolio === 'mixed' ? '#eab308' : '#22c55e'), 
            backgroundColor: charState.portfolio === 'concentrated' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)', 
            fill: true, tension: 0.4
        });

        chartInstance.data.datasets = datasets;

        if (currentStep === 'c5' || currentStep === 'c6') {
            chartInstance.options.plugins.annotation.annotations = {
                line1: {
                    type: 'line', xMin: `Age ${crashAge}`, xMax: `Age ${crashAge}`, borderColor: '#ef4444', borderWidth: 2, borderDash: [5,5],
                    label: { display: true, content: `Age ${crashAge}: Market Crash`, position: 'start' }
                }
            };
        }

        if (currentStep === 'c6') {
            const difference = crashData[years] - ghostData[years];
            updateScoreboard(true, "Final Wealth at Age 65", crashData[years], charState.portfolio === 'concentrated' ? 'text-red-500' : 'text-green-400',
                true, "Vs Ideal Diversification", difference, difference < 0 ? 'text-red-500' : 'text-gray-400');
        } else {
            updateScoreboard(false);
        }
    }

    chartInstance.update();
}

// --- Flow 2: Concept Logic ---
function updateConceptChart() {
    if(!chartInstance) return;

    chartInstance.options.plugins.annotation.annotations = {};
    chartInstance.options.scales.y.max = undefined;

    if (currentStep === 's1' || currentStep === 's2' || currentStep === 's3') {
        const years = 65 - conceptState.startAge;
        const labels = Array.from({length: years + 1}, (_, i) => `Age ${conceptState.startAge + i}`);
        const dataBase = calcCompoundPath(0, conceptState.pmt, conceptState.rate, 0, conceptState.startAge, 65);

        chartInstance.data.labels = labels;

        if(currentStep === 's1') {
            const dataContrib = calcCompoundPath(0, conceptState.pmt, 0, 0, conceptState.startAge, 65);
            updateScoreboard(true, 'Wealth at Age 65', dataBase[years], 'text-green-400');
            chartInstance.data.datasets = [
                { label: `Gross Return (${conceptState.rate}%)`, data: dataBase, borderColor: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.1)', fill: true, tension: 0.4 },
                { label: 'Linear Savings (Cash)', data: dataContrib, borderColor: '#9ca3af', borderDash: [5,5], fill: false, tension: 0 }
            ];
        } 
        else if(currentStep === 's2') {
            // Compare starting early vs late
            // Base data is from 'startAge'. Let's show a ghost line of starting at 20.
            const labelsAll = Array.from({length: 46}, (_, i) => `Age ${20 + i}`); // 20 to 65
            const dataStart20 = calcCompoundPath(0, conceptState.pmt, conceptState.rate, 0, 20, 65);
            
            // Pad the current delayed start data with nulls so it aligns on the x-axis
            const delayYears = conceptState.startAge - 20;
            const dataDelayed = Array(delayYears).fill(null).concat(dataBase);
            
            const costOfDelay = dataBase[years] - dataStart20[45];

            updateScoreboard(true, `Wealth (Start Age ${conceptState.startAge})`, dataBase[years], 'text-brand-400', 
                conceptState.startAge > 20, "Cost of waiting", costOfDelay, 'text-red-400');

            chartInstance.data.labels = labelsAll;
            chartInstance.data.datasets = [
                { label: `Start at Age 20`, data: dataStart20, borderColor: '#d1d5db', borderDash: [5,5], fill: false, tension: 0.4 },
                { label: `Start at Age ${conceptState.startAge}`, data: dataDelayed, borderColor: '#0ea5e9', backgroundColor: 'rgba(14, 165, 233, 0.1)', fill: true, tension: 0.4 }
            ];
        }
        else if(currentStep === 's3') {
            const dataFee = calcCompoundPath(0, conceptState.pmt, conceptState.rate, conceptState.fee, conceptState.startAge, 65);
            
            const lostToFees = dataBase[years] - dataFee[years];
            
            updateScoreboard(true, "Wealth After Fees", dataFee[years], 'text-red-400',
                true, "Lost to Wall Street", -lostToFees, 'text-red-500');

            chartInstance.data.datasets = [
                { label: `Gross Return (${conceptState.rate}%)`, data: dataBase, borderColor: '#16a34a', fill: false, borderDash: [5,5], tension: 0.4 },
                { label: `After ${conceptState.fee.toFixed(2)}% Fee`, data: dataFee, borderColor: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true, tension: 0.4 }
            ];
        }
        
        chartInstance.update();
    } 
    else if (currentStep === 's4') {
        // The Shield of Diversification (Bankruptcy Simulation)
        const years = 30; // 30 year horizon
        const crashYear = 10;
        const labels = Array.from({length: years + 1}, (_, i) => `Year ${i}`);
        
        // Fixed starting scenario for clarity
        const initialInvestment = 10000;
        const growthRate = 8;
        
        // Calculate portfolio shock from one company outcome.
        // Example: companyOutcomePct = -100 and companies=1 => total loss.
        // Example: companyOutcomePct = +400 and companies=500 => tiny boost.
        const weight = 1 / conceptState.companies;
        const shockMultiplier = 1 + (conceptState.companyOutcomePct / 100) * weight;

        // Path without bankruptcy
        let dataBase = [];
        let val = initialInvestment;
        for(let i=0; i<=years; i++) {
            if (i > 0) val = val * (1 + growthRate/100);
            dataBase.push(val);
        }

        // Path with bankruptcy at Year 10
        let dataCrash = [];
        let valCrash = initialInvestment;
        for(let i=0; i<=years; i++) {
            if (i > 0) {
                if (i === crashYear) {
                    valCrash = valCrash * shockMultiplier;
                } else {
                    valCrash = valCrash * (1 + growthRate/100);
                }
            }
            dataCrash.push(valCrash);
        }

        chartInstance.data.labels = labels;
        chartInstance.data.datasets = [
            {
                label: `No Bankruptcies`,
                data: dataBase,
                borderColor: '#d1d5db',
                borderDash: [5,5],
                fill: false,
                tension: 0.4
            },
            {
                label: `Portfolio (${conceptState.companies} Companies)`,
                data: dataCrash,
                borderColor: conceptState.companies === 1 ? '#ef4444' : '#0ea5e9',
                backgroundColor: conceptState.companies === 1 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(14, 165, 233, 0.1)',
                fill: true,
                tension: 0.4
            }
        ];

        const outcomeLabel = conceptState.companyOutcomePct >= 0 ? `Year 10: One Company Jumps ${conceptState.companyOutcomePct}%` : `Year 10: One Company Falls ${Math.abs(conceptState.companyOutcomePct)}%`;

        chartInstance.options.plugins.annotation.annotations = {
            line1: {
                type: 'line', xMin: `Year ${crashYear}`, xMax: `Year ${crashYear}`, borderColor: conceptState.companyOutcomePct >= 0 ? '#22c55e' : '#ef4444', borderWidth: 2, borderDash: [5,5],
                label: { display: true, content: outcomeLabel, position: 'start' }
            }
        };

        const difference = dataCrash[years] - dataBase[years];
        updateScoreboard(true, `Wealth (Year 30)`, dataCrash[years], '',
            true, difference >= 0 ? "Gain from Concentration" : "Cost of Concentration", difference, '');

        chartInstance.update();
    }
}
