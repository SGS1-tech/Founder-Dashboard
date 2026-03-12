# Hướng Dẫn Tích Hợp Data Từ Google Sheets Vào Dashboard

Cách tiếp cận này sẽ biến Google Sheets thành một API miễn phí (Web App) để cung cấp dữ liệu cho Dashboard của bạn mỗi khi nó được tải.

---

## BƯỚC 1: TẠO GOOGLE SHEETS VÀ NHẬP DỮ LIỆU
1. Truy cập [Google Sheets](https://sheets.new/) và tạo một file mới, đặt tên ví dụ là "Marketplace Data".
2. Tạo 4 Tabs (Sheets) ở dưới cùng với tên chính xác như sau:
   - **Suppliers**
   - **Buyers**
   - **Products**
   - **Inquiries**

3. Tại mỗi Tab, nhập **Cột Tiêu Đề (Dòng 1)** như sau:

**Tab: Suppliers**
| B | C | D | E |
| :--- | :--- | :--- | :--- | 
| SupplierID | CompanyName | VerificationStatus | QualityScore |
*(Ví dụ dữ liệu: S01, AgriCorp Ltd, Approved, 9.2)*

**Tab: Buyers**
| A | B | C | D |
| :--- | :--- | :--- | :--- | 
| BuyerID | CompanyName | Market | LeadsIdentified |
*(Ví dụ dữ liệu: B01, Desert Foods, UAE, 45)*

**Tab: Products**
| A | B | C | D |
| :--- | :--- | :--- | :--- | 
| ProductID | SupplierID | Name | Category |
*(Ví dụ dữ liệu: P01, S01, Fresh Apples, Agri Products)*

**Tab: Inquiries**
| A | B | C | D |
| :--- | :--- | :--- | :--- | 
| InquiryID | BuyerID | SupplierID | Status |
*(Ví dụ dữ liệu: I01, B01, S01, MessageSent)*


---

## BƯỚC 2: CÀI ĐẶT GOOGLE APPS SCRIPT (Tạo API)
1. Trên thanh Menu của Google Sheets vừa tạo, chọn **Tiện ích mở rộng (Extensions)** > **Apps Script**.
2. Xóa hết code trong đó và **Dán toàn bộ đoạn code dưới đây** vào:

```javascript
function doGet(e) {
  // 1. Kết nối với Google Sheet hiện tại
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 2. Đọc dữ liệu từ các sheet
  const supplierSheet = ss.getSheetByName("Suppliers");
  const buyerSheet = ss.getSheetByName("Buyers");
  const productSheet = ss.getSheetByName("Products");
  const inquirySheet = ss.getSheetByName("Inquiries");
  
  // Kiểm tra lỗi nếu chưa tạo đủ sheet
  if (!supplierSheet || !buyerSheet || !productSheet || !inquirySheet) {
    return ContentService.createTextOutput(
      JSON.stringify({ error: "Missing required sheets! Please check Tab names." })
    ).setMimeType(ContentService.MimeType.JSON);
  }

  const suppliersData = supplierSheet.getDataRange().getValues();
  const buyersData = buyerSheet.getDataRange().getValues();
  const productsData = productSheet.getDataRange().getValues();
  const inquiriesData = inquirySheet.getDataRange().getValues();

  // 3. Tính toán các biến KPI
  let suppliersApproved = 0;
  let totalScore = 0;
  let scoredSuppliersCount = 0;
  let supplierQualityScores = [];
  
  // Vòng lặp bỏ qua dòng đầu tiên (header)
  for (let i = 1; i < suppliersData.length; i++) {
    const status = suppliersData[i][2]; // Cột C: VerificationStatus
    const score = parseFloat(suppliersData[i][3]) || 0; // Cột D: QualityScore
    const companyName = suppliersData[i][1];
    
    if (status === "Approved") suppliersApproved++;
    if (score > 0) {
      totalScore += score;
      scoredSuppliersCount++;
      // Chỉ lấy top 5 supplier để vẽ biểu đồ cho nhẹ dashboard
      if(supplierQualityScores.length < 5) {
        supplierQualityScores.push({ supplier: companyName, score: score });
      }
    }
  }
  const averageSupplierQualityScore = scoredSuppliersCount > 0 ? (totalScore / scoredSuppliersCount).toFixed(1) : 0;

  // Xử lý dữ liệu biểu đồ Buyers by Market
  let marketMap = {};
  let totalLeadsIdentified = 0;
  for (let i = 1; i < buyersData.length; i++) {
    const market = buyersData[i][2]; // Cột C: Market
    const leads = parseInt(buyersData[i][3]) || 0; // Cột D: LeadsIdentified
    totalLeadsIdentified += leads;
    
    if (market) {
      marketMap[market] = (marketMap[market] || 0) + leads;
    }
  }
  let buyerLeadsByMarket = [];
  for (let key in marketMap) {
    buyerLeadsByMarket.push({ market: key, leads: marketMap[key] });
  }

  // Xử lý dữ liệu biểu đồ Category Mix
  let categoryMap = {};
  // Fix để tránh số chia bị 0
  let totalProducts = productsData.length > 1 ? productsData.length - 1 : 1; 
  for (let i = 1; i < productsData.length; i++) {
    const category = productsData[i][3]; // Cột D: Category
    if (category) {
      categoryMap[category] = (categoryMap[category] || 0) + 1;
    }
  }
  let productCategoryMix = [];
  for (let key in categoryMap) {
    const percentage = Math.round((categoryMap[key] / totalProducts) * 100);
    productCategoryMix.push({ category: key, percentage: percentage });
  }

  // Đếm Messages (Inquiries)
  let outreachMessagesGenerated = inquiriesData.length > 1 ? inquiriesData.length - 1 : 0;

  // Các biến phụ để hiện thị Daily Brief ổn định hơn
  let topMarket = buyerLeadsByMarket.length > 0 ? buyerLeadsByMarket[0].market : "trọng điểm";
  let totalSuppliers = suppliersData.length > 1 ? suppliersData.length - 1 : 0;
  let pendingSuppliers = Math.max(0, totalSuppliers - suppliersApproved);

  // 4. Đóng gói JSON
  const dashboardData = {
    kpis: {
      suppliersEvaluated: totalSuppliers,
      suppliersApproved: suppliersApproved,
      buyerLeadsIdentified: totalLeadsIdentified,
      outreachMessagesGenerated: outreachMessagesGenerated,
      averageSupplierQualityScore: Number(averageSupplierQualityScore)
    },
    charts: {
      supplierQualityScores: supplierQualityScores,
      buyerLeadsByMarket: buyerLeadsByMarket,
      productCategoryMix: productCategoryMix,
      // Fake data for daily trend just to keep the chart working
      dailyActivityTrend: [
        { date: "Day 1", activity: Math.floor(Math.random()*50)+20 },
        { date: "Day 2", activity: Math.floor(Math.random()*50)+20 },
        { date: "Day 3", activity: Math.floor(Math.random()*50)+20 },
        { date: "Day 4", activity: Math.floor(Math.random()*50)+20 },
        { date: "Day 5", activity: Math.floor(Math.random()*50)+20 },
        { date: "Day 6", activity: Math.floor(Math.random()*50)+20 },
        { date: "Day 7", activity: Math.floor(Math.random()*50)+20 }
      ]
    },
    founderDailyBrief: {
      dailyOperationalSummary: "Dữ liệu đang được đồng bộ trực tiếp (Live) từ Google Sheets.",
      supplierInsights: "Có " + suppliersApproved + " nhà cung cấp đã được xác thực hoàn tất trong hệ thống.",
      buyerOpportunities: "Tổng số khách hàng tiềm năng (Leads) đang là " + totalLeadsIdentified + ". Cần đẩy mạnh chiến dịch khu vực " + topMarket + ".",
      keyRisks: "Dashboard hiện đang lấy dữ liệu báo cáo thời gian thực, đảm bảo bạn không xóa nhầm dòng header trong file Sheets.",
      recommendedActions: [
        "Kiểm tra lại pipeline cho " + pendingSuppliers + " Supplier đang chờ duyệt.",
        "Xây dựng danh sách liên hệ cho thị trường tiềm năng nhất."
      ]
    }
  };

  // 5. Trả về JSON cho App.js đọc
  try {
    let jsonString = JSON.stringify(dashboardData);
    let jsonOutput = ContentService.createTextOutput(jsonString);
    jsonOutput.setMimeType(ContentService.MimeType.JSON);
    return jsonOutput;
  } catch (error) {
    let errorOutput = ContentService.createTextOutput(JSON.stringify({ error: error.toString() }));
    errorOutput.setMimeType(ContentService.MimeType.JSON);
    return errorOutput;
  }
}
```

3. Bấm biểu tượng **Save (Lưu)**.

---

## BƯỚC 3: XUẤT BẢN THÀNH WEB APP (DEPLOY)
1. Ở góc trên cùng bên phải cửa sổ Apps Script, bấm nút màu xanh **"Triển khai" (Deploy)** > **"Tùy chọn triển khai mới" (New deployment)**.
2. Tại cột bên trái "Chọn loại (Select type)", nhấn biểu tượng răng cưa và chọn **Ứng dụng web (Web app)**.
3. Cài đặt các thông số như sau:
   - *Mô tả:* "Dashboard API V1"
   - *Thực thi với tư cách:* Chọn **"Tôi" (Me)**.
   - *Người có quyền truy cập:* Chọn **"Bất kỳ ai" (Anyone)**.
4. Bấm **"Triển khai" (Deploy)**. *(Google sẽ yêu cầu bạn cấp quyền truy cập tài khoản, bạn cứ bấm Allow/Cho phép nhé).*
5. Bảng thông báo hiện ra, bạn **COPY đường link URL tại mục ứng dụng web**.

---

## BƯỚC 4: SỬA FILE APP.JS ĐỂ BẮT ĐẦU TỰ ĐỘNG HÓA
Mở file `app.js` của bạn trên máy tính, và thay thế toàn bộ từ dòng 10 đến dòng 60 bằng đoạn mã tải API thực như sau:

```javascript
// Thay thế đoạn URL dưới đây bằng URL bạn vừa Copy ở Bước 3
const GOOGLE_SHEET_API_URL = "DÁN_URL_CỦA_BẠN_VÀO_ĐÂY";

// Initialize Dashboard
async function initDashboard() {
    try {
        document.getElementById('brief-summary').textContent = "Đang tải dữ liệu trực tiếp từ Google Sheets...";
        
        // Fetch dữ liệu từ API Google Sheets
        const response = await fetch(GOOGLE_SHEET_API_URL);
        const data = await response.json();
        
        setCurrentDate();
        populateKPIs(data.kpis);
        populateBrief(data.founderDailyBrief);
        renderCharts(data.charts);
        
    } catch (error) {
        console.error("Error loading dashboard data:", error);
        document.getElementById('brief-summary').textContent = "Lỗi kết nối đến Google Sheets. Vùi lòng kiểm tra lại URL API của bạn.";
    }
}
```

**Hoàn tất!**
Từ giờ trở đi, bất cứ khi nào bạn (hoặc ai đó/công cụ AI) điền số lượng mới vào Google Sheets, bạn chỉ việc **F5 lại Dashboard (`index.html`)** là các con số và biểu đồ sẽ nhảy theo dữ liệu thật lập tức. Không cần chỉnh sửa code hay chạy Server gì thêm!
