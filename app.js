// Utility to set current date
function setCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    const date = new Date().toLocaleDateString('en-US', options);
    document.getElementById('currentDate').textContent = date;
}

// Global Chart Configuration for Dark Theme
Chart.defaults.color = '#9ca3af';
Chart.defaults.font.family = "'Inter', sans-serif";
Chart.defaults.scale.grid.color = 'rgba(255, 255, 255, 0.05)';

// Thay thế đoạn URL dưới đây bằng URL bạn copy được sau khi Deploy Google Apps Script thành công
const GOOGLE_SHEET_API_URL = "https://script.googleusercontent.com/macros/echo?user_content_key=AY5xjrSsuig2P-PHoySRb8xI3yKnha3hpqcwRnIaEMK1OergzmEFvV1UmbXKrU4UKdQI8OUsrpFTZnsMIEjr0fUsSNd3JPcA5tGSxHw_OHcQm82L2JvG5_buLFfx27qIQUrVnu9R84Rre-28KV92T4NazI04WhixEIKsdDxUDODo2bo_Wnyod5-s4j1FgcY0c7Qnxj91bwXew9CBVxM_KvQOd1pI92Ta54NKv1gbYtxWGOgZXM8_GY-ut2neqGilfprjo17VRunZJeO_kgGxs_g73CS6HfS9YGgkI376Z0YW&lib=MRmNld0FxmfTrqbKz3kyGjeDPTor89BOr";

// Initialize Dashboard
async function initDashboard() {
    try {
        document.getElementById('brief-summary').textContent = "Đang tải dữ liệu trực tiếp từ Google Sheets...";

        // Cố gắng Fetch dữ liệu từ API Google Sheets
        if (!GOOGLE_SHEET_API_URL || GOOGLE_SHEET_API_URL.includes("YOUR_URL_HERE")) {
            throw new Error("Chưa có URL API. Bạn hãy dán URL Web App lấy từ Google Sheets vào biến GOOGLE_SHEET_API_URL trong file app.js nhé.");
        }
        
        const response = await fetch(GOOGLE_SHEET_API_URL);
    const data = await response.json();

    // Kiểm tra nếu API trả về lỗi do người dùng chưa setup Sheet đúng
    if (data.error) {
        throw new Error("Lỗi từ Google Sheets: " + data.error);
    }

    setCurrentDate();
    populateKPIs(data.kpis);
    populateBrief(data.founderDailyBrief);
    renderCharts(data.charts);

} catch (error) {
    console.error("Error loading dashboard data:", error);
    document.getElementById('brief-summary').textContent = "Lỗi tải dữ liệu: " + error.message;
}
}

// Populate KPI Cards
function populateKPIs(kpis) {
    document.getElementById('kpi-evaluated').textContent = kpis.suppliersEvaluated;
    document.getElementById('kpi-approved').textContent = kpis.suppliersApproved;
    document.getElementById('kpi-leads').textContent = kpis.buyerLeadsIdentified;
    document.getElementById('kpi-outreach').textContent = kpis.outreachMessagesGenerated;
    document.getElementById('kpi-score').textContent = kpis.averageSupplierQualityScore;
}

// Populate Founder Brief
function populateBrief(brief) {
    document.getElementById('brief-summary').textContent = brief.dailyOperationalSummary;
    document.getElementById('brief-insights').textContent = brief.supplierInsights;
    document.getElementById('brief-opportunities').textContent = brief.buyerOpportunities;
    document.getElementById('brief-risks').textContent = brief.keyRisks;

    const actionsList = document.getElementById('brief-actions');
    actionsList.innerHTML = ''; // Clear loading state

    brief.recommendedActions.forEach(action => {
        const li = document.createElement('li');
        li.textContent = action;
        actionsList.appendChild(li);
    });
}

// Render Charts
function renderCharts(chartsData) {
    // 1. Daily Activity Trend (Line Chart)
    const trendCtx = document.getElementById('trendChart').getContext('2d');

    // Create gradient
    const gradient = trendCtx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.4)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0.0)');

    new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: chartsData.dailyActivityTrend.map(d => d.date),
            datasets: [{
                label: 'System Interactions/Activity',
                data: chartsData.dailyActivityTrend.map(d => d.activity),
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: '#0f1115',
                pointBorderColor: '#3b82f6',
                pointBorderWidth: 2,
                pointRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true }
            }
        }
    });

    // 2. Buyer Leads by Market (Bar Chart)
    const marketCtx = document.getElementById('marketChart').getContext('2d');
    new Chart(marketCtx, {
        type: 'bar',
        data: {
            labels: chartsData.buyerLeadsByMarket.map(d => d.market),
            datasets: [{
                data: chartsData.buyerLeadsByMarket.map(d => d.leads),
                backgroundColor: 'rgba(139, 92, 246, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // 3. Product Category Mix (Doughnut Chart)
    const mixCtx = document.getElementById('mixChart').getContext('2d');
    new Chart(mixCtx, {
        type: 'doughnut',
        data: {
            labels: chartsData.productCategoryMix.map(d => d.category),
            datasets: [{
                data: chartsData.productCategoryMix.map(d => d.percentage),
                backgroundColor: ['#10b981', '#f59e0b'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 20, color: '#f3f4f6' }
                }
            }
        }
    });

    // 4. Supplier Quality Scores (Horizontal Bar Chart)
    const supplierCtx = document.getElementById('supplierChart').getContext('2d');
    new Chart(supplierCtx, {
        type: 'bar',
        data: {
            labels: chartsData.supplierQualityScores.map(d => d.supplier),
            datasets: [{
                data: chartsData.supplierQualityScores.map(d => d.score),
                backgroundColor: 'rgba(20, 184, 166, 0.8)',
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { beginAtZero: true, max: 10 }
            }
        }
    });
}

// Start application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initDashboard(); // Tải dữ liệu lần đầu
    
    // Tự động làm mới dữ liệu mỗi 5 phút (300,000 milliseconds)
    setInterval(() => {
        console.log("Auto-refreshing dashboard data...");
        initDashboard();
    }, 300000);
});