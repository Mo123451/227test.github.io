// 东方财富融资融券数据可视化
// 从东方财富API通过代理服务器获取真实数据

// 确保DOM加载完成后执行
window.addEventListener('DOMContentLoaded', function() {
    // 全局变量
      let stockData = [];
      let originalStockData = []; // 保存原始完整的十年数据
      let isFiltered = false; // 是否应用了筛选
      let stockChart = null;
      let currentStockCode = '600704'; // 当前股票代码
      let currentStockName = '物产中大'; // 当前股票名称
      // 注：股票名称将从API返回的数据中获取，不再使用映射表
      // 后端代理服务器地址
// 本地开发时使用：http://localhost:8001
// Vercel部署时改为：https://你的项目名称.vercel.app
const API_BASE_URL = 'http://qscs027-asmi8ddu.edgeone.run';
    
    // 设置默认日期
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];
    
    // 设置十年前的日期（用于后台数据获取）
    const tenYearsAgo = new Date();
    tenYearsAgo.setFullYear(tenYearsAgo.getFullYear() - 10);
    const formattedTenYearsAgo = tenYearsAgo.toISOString().split('T')[0];
    
    // 设置一个月前的日期（用于首次显示）
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const formattedOneMonthAgo = oneMonthAgo.toISOString().split('T')[0];
    // 更新页面标题
    function updatePageTitle(stockCode, stockName) {
        const headerTitle = document.querySelector('header h1');
        if (headerTitle) {
            headerTitle.textContent = `${stockName}（${stockCode}）融资融券数据分析`;
        }
        
        // 更新文档标题
        document.title = `${stockName}融资融券数据分析`;
    }
    
    // 从东方财富Choice数据获取真实融资融券数据
      async function fetchRealData(stockCode = '600704') {
          // 清除localStorage中的旧数据，避免影响新数据加载
          localStorage.removeItem('stockData');
          
          try {
              showMessage(`正在获取股票 ${stockCode} 数据...`, 'info');
              console.log(`正在获取股票 ${stockCode} 的数据`);
              
              const response = await fetch(`${API_BASE_URL}/api/stock/margin-trading?code=${stockCode}`);
              
              if (!response.ok) {
                  throw new Error(`API错误: ${response.status}`);
              }
              
              const data = await response.json();
              console.log('获取到的数据:', data);
              
              // 移除一个月限制，获取所有可用数据
              
              // 处理API返回的数据结构
              if (Array.isArray(data)) {
                  // 确保数据有效
                  if (data.length > 0 && data[0].date && data[0].financingBalance !== undefined) {
                      console.log(`原始数据共 ${data.length} 条，使用全部数据`);
                       
                      // 使用所有数据，不再限制为最近一个月
                      stockData = data;
                       
                      showMessage(`成功获取股票 ${stockCode} 的 ${stockData.length} 条数据`, 'success');
                  } else {
                      throw new Error('返回的数据结构无效');
                  }
              } else if (data && typeof data === 'object') {
                  // 处理可能的替代数据格式（如dates和values分离的格式）
                  if (data.dates && data.financingBalances) {
                      console.log(`接收到分离式数据格式，共 ${data.dates.length} 条记录`);
                       
                      // 将分离式数据转换为统一格式，使用所有数据
                      const unifiedData = [];
                      for (let i = 0; i < data.dates.length; i++) {
                          unifiedData.push({
                              date: data.dates[i],
                              financingBalance: data.financingBalances[i],
                              securitiesBalance: data.securitiesLendingBalances ? data.securitiesLendingBalances[i] : 0,
                              closingPrice: data.closingPrices ? data.closingPrices[i] : 0
                          });
                      }
                       
                      stockData = unifiedData;
                      showMessage(`成功获取股票 ${stockCode} 的 ${stockData.length} 条数据`, 'success');
                  }
                  // 如果返回的是单个对象，转换为数组
                  else if (data.date && data.financingBalance !== undefined) {
                      stockData = [data];
                      showMessage(`成功获取股票 ${stockCode} 的数据`, 'success');
                  } else {
                      throw new Error('返回的数据结构无效');
                  }
              } else {
                  throw new Error('返回数据格式错误');
              }
            
            // 保存原始数据（完整十年数据）
            originalStockData = [...stockData];
            isFiltered = false;
            
            // 默认只显示最近一个月的数据
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            stockData = stockData.filter(item => new Date(item.date) >= oneMonthAgo);
            isFiltered = true;
            console.log(`已筛选出最近一个月数据，共 ${stockData.length} 条`);
            
            // 获取并更新股票名称
            // 尝试从返回的数据中获取股票名称，如果没有则使用默认格式
            const stockName = stockData.length > 0 && stockData[0] && stockData[0].stockName !== undefined && stockData[0].stockName !== null ? 
                stockData[0].stockName : 
                `股票${stockCode}`;
            currentStockName = stockName;
            updatePageTitle(stockCode, stockName);
            
            // 强制更新图表和表格
            console.log('更新图表和表格');
            updateDataTable(); // 先更新表格
            
            // 确保Chart.js已加载再创建图表
            if (typeof Chart !== 'undefined') {
                console.log('Chart.js已加载，创建图表');
                createChart();
            } else {
                console.error('Chart.js未加载，无法创建图表');
            }
            
            // 保存数据到本地存储
            saveData();
            
        } catch (error) {
            console.error('获取数据失败:', error);
            showMessage(`获取数据失败: ${error.message}`, 'danger');
            
            // 直接生成模拟数据，避免加载可能有问题的缓存
            stockData = generateMockData();
            originalStockData = [...stockData];
            showMessage('无法获取真实数据，已生成模拟数据', 'warning');
            
            // 强制更新图表和表格
            updateDataTable();
            
            // 确保Chart.js已加载再创建图表
            if (typeof Chart !== 'undefined') {
                console.log('Chart.js已加载，使用模拟数据创建图表');
                createChart();
            } else {
                console.error('Chart.js未加载，无法创建图表');
            }
        }
    }
    
    // 生成模拟东方财富融资融券数据（当API获取失败时使用）
    function generateMockData(days = 30) {
        const mockData = [];
        const now = new Date();
        
        // 生成指定天数的数据
        for (let i = days - 1; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            
            // 生成合理的模拟数据
            const financing = 120 + Math.sin(i / 5) * 10 + Math.random() * 5;
            const securities = 3000 + Math.cos(i / 7) * 500 + Math.random() * 200;
            const price = 7.5 + Math.sin(i / 3) * 0.8 + Math.random() * 0.3;
            
            mockData.push({
                date: date.toISOString().split('T')[0],
                financingBalance: parseFloat(financing.toFixed(2)),
                securitiesBalance: parseFloat(securities.toFixed(2)),
                closingPrice: parseFloat(price.toFixed(2))
            });
        }
        
        return mockData;
    }
    
    // 加载数据 - 优先从API获取，失败时从localStorage加载，再失败则使用模拟数据
    async function loadData() {
        try {
            // 尝试从东方财富API获取真实数据
            const realData = await fetchRealData();
            
            if (realData && realData.length > 0) {
                stockData = realData;
                saveData(); // 保存到localStorage作为缓存
                return;
            }
            
            throw new Error('未获取到有效数据');
        } catch (error) {
            console.log('尝试从localStorage加载数据...');
            const savedData = localStorage.getItem('stockData');
            
            if (savedData) {
                try {
                    stockData = JSON.parse(savedData);
                    showMessage('使用缓存数据', 'info');
                } catch (e) {
                    console.error('数据解析错误，使用模拟数据', e);
                    stockData = generateMockData(30); // 生成一个月的模拟数据
                    saveData();
                }
            } else {
                stockData = generateMockData(30); // 生成一个月的模拟数据
                saveData();
            }
        }
    }
    

    
    // 按日期范围筛选数据
    function filterDataByDateRange() {
        const startDateStr = document.getElementById('startDate').value;
        const endDateStr = document.getElementById('endDate').value;
        
        if (!startDateStr || !endDateStr) {
            showMessage('请选择有效的开始日期和结束日期', 'warning');
            return;
        }
        
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        if (startDate > endDate) {
            showMessage('开始日期不能晚于结束日期', 'warning');
            return;
        }
        
        // 确保保存了原始数据
        if (!isFiltered) {
            originalStockData = [...stockData];
        }
        
        // 筛选数据
        const filteredData = originalStockData.filter(item => {
            const itemDate = new Date(item.date);
            return itemDate >= startDate && itemDate <= endDate;
        });
        
        if (filteredData.length === 0) {
            showMessage('所选时间范围内没有数据', 'info');
            // 如果没有数据，显示全部数据
            if (isFiltered) {
                stockData = [...originalStockData];
                isFiltered = false;
                updateChart();
            }
        } else {
            // 使用筛选后的数据更新图表
            stockData = filteredData;
            isFiltered = true;
            updateChart();
            
            showMessage(`已筛选出 ${filteredData.length} 条数据`, 'success');
        }
    }
    
    // 重置筛选，显示所有数据
    function resetFilter() {
        if (isFiltered && originalStockData.length > 0) {
            stockData = [...originalStockData];
            isFiltered = false;
            updateChart();
            showMessage('已重置筛选，显示全部数据', 'info');
        }
    }
    
    // 获取最新数据（点击按钮时调用）
    async function fetchLatestData() {
        try {
            // 获取当前日期
            const today = new Date();
            const formattedDate = today.toISOString().split('T')[0];
            
            showMessage('正在获取最新数据...', 'info');
            const response = await fetch(`${API_BASE_URL}/api/stock/margin-trading?date=${formattedDate}&code=${currentStockCode}`);
            
            if (!response.ok) {
                throw new Error(`API错误: ${response.status}`);
            }
            
            const latestData = await response.json();
            
            // 如果获取到最新数据，更新数据
            if (latestData && typeof latestData === 'object') {
                // 检查是否已存在该日期的数据
                const existingIndex = stockData.findIndex(item => item.date === latestData.date);
                
                if (existingIndex >= 0) {
                    // 更新已有数据
                    stockData[existingIndex] = latestData;
                } else {
                    // 添加新数据
                    stockData.push(latestData);
                    // 按日期排序
                    stockData.sort((a, b) => new Date(a.date) - new Date(b.date));
                }
                
                // 保存原始数据
                originalStockData = [...stockData];
                
                // 更新图表和表格
                updateChart();
                updateDataTable();
                
                // 保存数据
                saveData();
                
                showMessage('数据已更新至最新', 'success');
            } else {
                showMessage('无法获取最新数据', 'warning');
            }
        } catch (error) {
            console.error('更新数据失败:', error);
            showMessage(`更新数据失败: ${error.message}`, 'danger');
        }
    }
    
    // 搜索股票代码
    async function searchStock() {
        const stockCodeInput = document.getElementById('stockCode').value.trim();
        
        if (!stockCodeInput) {
            showMessage('请输入股票代码', 'warning');
            return;
        }
        
        // 简单验证股票代码格式（6位数字）
        if (!/^\d{6}$/.test(stockCodeInput)) {
            showMessage('股票代码格式错误，请输入6位数字', 'warning');
            return;
        }
        
        // 设置当前股票代码
        currentStockCode = stockCodeInput;
        
        // 获取该股票的数据
        await fetchRealData(currentStockCode);
        
        // 确保数据表格和图表已更新
        if (stockData.length > 0) {
            updateDataTable();
            updateChart();
        }
    }
    
    // 更新数据表格，以倒序方式显示筛选后的数据
    function updateDataTable() {
        const tableBody = document.getElementById('dataTableBody');
        if (!tableBody) return;
        
        // 清空表格
        tableBody.innerHTML = '';
        
        // 创建数据副本并倒序排序（最新数据在前）
        const sortedData = [...stockData].sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // 添加数据行
        sortedData.forEach(item => {
            const row = document.createElement('tr');
            
            // 格式化数据
            const financingBalanceYuan = (item.financingBalance / 100000000).toFixed(2); // 转换为亿元
            const securitiesBalanceWan = (item.securitiesBalance / 10000).toFixed(2); // 转换为万元
            
            row.innerHTML = `
                <td>${item.date}</td>
                <td>${item.closingPrice}</td>
                <td>${financingBalanceYuan}</td>
                <td>${securitiesBalanceWan}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    // 更新数据集中的最新数据
    function updateDataWithLatest(newData) {
        // 如果是数组，更新或添加每条记录
        if (Array.isArray(newData)) {
            newData.forEach(item => {
                const existingIndex = stockData.findIndex(dataItem => dataItem.date === item.date);
                if (existingIndex >= 0) {
                    stockData[existingIndex] = item;
                } else {
                    stockData.push(item);
                }
            });
        } else if (newData.date) {
            // 如果是单个对象，更新或添加
            const existingIndex = stockData.findIndex(item => item.date === newData.date);
            if (existingIndex >= 0) {
                stockData[existingIndex] = newData;
            } else {
                stockData.push(newData);
            }
        }
        
        // 按日期排序
        stockData.sort((a, b) => new Date(a.date) - new Date(b.date));
    }
    
    // 保存数据到localStorage
    function saveData() {
        localStorage.setItem('stockData', JSON.stringify(stockData));
    }
    
    // 创建放大按钮 - 独立于Chart.js缩放插件的实现
    function createZoomButtons() {
        // 检查是否已存在放大按钮容器
        let zoomButtonsContainer = document.getElementById('zoomButtonsContainer');
        if (zoomButtonsContainer) {
            zoomButtonsContainer.remove();
        }
        
        // 确保DOM元素存在
        const chartCanvas = document.getElementById('stockChart');
        if (!chartCanvas) {
            console.error('图表画布元素未找到');
            return;
        }
        
        // 创建放大按钮容器
        zoomButtonsContainer = document.createElement('div');
        zoomButtonsContainer.id = 'zoomButtonsContainer';
        zoomButtonsContainer.className = 'drag-buttons-container'; // 保持相同的CSS类
        zoomButtonsContainer.innerHTML = `
            <div class="drag-buttons">
                <button id="zoomIn" class="btn btn-sm btn-outline-secondary">🔍 放大</button>
                <button id="zoomOut" class="btn btn-sm btn-outline-secondary">🔍 缩小</button>
                <button id="resetZoom" class="btn btn-sm btn-outline-secondary">重置视图</button>
            </div>
        `;
        
        // 将按钮容器添加到图表容器上方
        const chartContainer = chartCanvas.parentElement;
        if (chartContainer) {
            chartContainer.insertBefore(zoomButtonsContainer, chartCanvas);
            console.log('放大按钮已添加到DOM');
        } else {
            // 如果没有父容器，直接添加到body
            document.body.appendChild(zoomButtonsContainer);
            console.log('放大按钮已添加到body');
        }
        
        // 添加放大按钮事件监听
        document.getElementById('zoomIn').addEventListener('click', () => {
            if (stockChart && stockData.length > 0) {
                try {
                    // 操作x轴的min和max属性，实现放大功能
                    const xScale = stockChart.scales.x;
                    const labels = stockChart.data.labels;
                    const dataPointsCount = labels.length;
                    
                    // 确保选项对象存在
                    if (!stockChart.options.scales.x) {
                        stockChart.options.scales.x = {};
                    }
                    
                    let currentMinIndex = Math.floor(xScale.min);
                    let currentMaxIndex = Math.ceil(xScale.max);
                    
                    // 如果当前没有设置范围（null），设置为默认范围
                    if (xScale.min === null || xScale.max === null) {
                        currentMinIndex = 0;
                        currentMaxIndex = dataPointsCount - 1;
                    }
                    
                    // 计算当前可见范围
                    const currentRange = currentMaxIndex - currentMinIndex;
                    
                    // 放大：将可见范围缩小为原来的80%
                    const newRange = Math.max(10, Math.floor(currentRange * 0.8));
                    const centerIndex = Math.floor((currentMinIndex + currentMaxIndex) / 2);
                    
                    // 计算新的范围，保持中心点不变
                    const newMinIndex = Math.max(0, centerIndex - Math.floor(newRange / 2));
                    const newMaxIndex = Math.min(dataPointsCount - 1, centerIndex + Math.ceil(newRange / 2));
                    
                    // 通过options应用新的范围（Chart.js推荐方式）
                    stockChart.options.scales.x.min = newMinIndex;
                    stockChart.options.scales.x.max = newMaxIndex;
                    stockChart.update();
                    console.log('图表放大:', {newMinIndex, newMaxIndex});
                } catch (error) {
                    console.error('放大失败:', error);
                    showMessage('图表放大功能暂不可用', 'info');
                }
            }
        });
        
        // 添加缩小按钮事件监听
        document.getElementById('zoomOut').addEventListener('click', () => {
            if (stockChart && stockData.length > 0) {
                try {
                    // 操作x轴的min和max属性，实现缩小功能
                    const xScale = stockChart.scales.x;
                    const labels = stockChart.data.labels;
                    const dataPointsCount = labels.length;
                    
                    // 确保选项对象存在
                    if (!stockChart.options.scales.x) {
                        stockChart.options.scales.x = {};
                    }
                    
                    let currentMinIndex = Math.floor(xScale.min);
                    let currentMaxIndex = Math.ceil(xScale.max);
                    
                    // 如果当前没有设置范围（null），已经是完整视图，无需缩小
                    if (xScale.min === null || xScale.max === null) {
                        showMessage('已显示完整数据范围', 'info');
                        return;
                    }
                    
                    // 计算当前可见范围
                    const currentRange = currentMaxIndex - currentMinIndex;
                    
                    // 缩小：将可见范围扩大为原来的125%
                    const newRange = Math.min(dataPointsCount - 1, Math.ceil(currentRange * 1.25));
                    const centerIndex = Math.floor((currentMinIndex + currentMaxIndex) / 2);
                    
                    // 计算新的范围，保持中心点不变
                    const newMinIndex = Math.max(0, centerIndex - Math.floor(newRange / 2));
                    const newMaxIndex = Math.min(dataPointsCount - 1, centerIndex + Math.ceil(newRange / 2));
                    
                    // 通过options应用新的范围（Chart.js推荐方式）
                    stockChart.options.scales.x.min = newMinIndex;
                    stockChart.options.scales.x.max = newMaxIndex;
                    stockChart.update();
                    console.log('图表缩小:', {newMinIndex, newMaxIndex});
                } catch (error) {
                    console.error('缩小失败:', error);
                    showMessage('图表缩小功能暂不可用', 'info');
                }
            }
        });
        
        document.getElementById('resetZoom').addEventListener('click', () => {
            if (stockChart) {
                try {
                    // 重置图表视图
                    stockChart.options.scales.x.min = null;
                    stockChart.options.scales.x.max = null;
                    stockChart.update();
                    console.log('重置图表视图');
                    showMessage('已重置图表视图', 'success');
                } catch (error) {
                    console.error('重置失败:', error);
                    showMessage('重置功能暂不可用', 'info');
                }
            }
        });
    }
    
    // 创建X轴拖动条
    function createDragBar() {
        // 检查是否已存在拖动条
        let dragBarContainer = document.getElementById('dragBarContainer');
        if (dragBarContainer) {
            dragBarContainer.remove();
        }
        
        // 确保DOM元素存在
        const chartCanvas = document.getElementById('stockChart');
        if (!chartCanvas) {
            console.error('图表画布元素未找到');
            return;
        }
        
        // 创建拖动条容器
        dragBarContainer = document.createElement('div');
        dragBarContainer.id = 'dragBarContainer';
        dragBarContainer.className = 'drag-bar-container';
        
        // 创建拖动条
        dragBarContainer.innerHTML = `
            <div class="drag-bar-track">
                <div class="drag-bar-thumb"></div>
            </div>
        `;
        
        // 将拖动条添加到图表容器上方
        const chartContainer = chartCanvas.parentElement;
        if (chartContainer) {
            // 找到图表容器中的其他元素，确保拖动条位置正确
            const zoomButtons = document.getElementById('zoomButtonsContainer');
            if (zoomButtons) {
                chartContainer.insertBefore(dragBarContainer, zoomButtons.nextSibling);
            } else {
                chartContainer.insertBefore(dragBarContainer, chartCanvas);
            }
            console.log('X轴拖动条已添加到DOM');
        } else {
            // 如果没有父容器，直接添加到body
            document.body.appendChild(dragBarContainer);
            console.log('X轴拖动条已添加到body');
        }
        
        // 获取拖动条元素
        const track = dragBarContainer.querySelector('.drag-bar-track');
        const thumb = dragBarContainer.querySelector('.drag-bar-thumb');
        
        let isDragging = false;
        let startX;
        let startMin;
        let startMax;
        
        // 更新拖动条位置
        function updateThumbPosition() {
            if (!stockChart) return;
            
            const xScale = stockChart.scales.x;
            const dataPointsCount = stockChart.data.labels.length;
            
            // 如果没有设置范围，隐藏拖动条
            if (xScale.min === null || xScale.max === null || dataPointsCount === 0) {
                thumb.style.display = 'none';
                return;
            }
            
            thumb.style.display = 'block';
            
            // 计算拖动条位置和大小
            const min = Math.floor(xScale.min);
            const max = Math.ceil(xScale.max);
            const range = max - min;
            const percentage = (range / dataPointsCount) * 100;
            const position = (min / dataPointsCount) * 100;
            
            // 限制拖动条大小，确保至少有最小宽度
            const minWidth = 10; // 最小宽度百分比
            const finalWidth = Math.max(minWidth, percentage);
            const finalPosition = Math.min(100 - finalWidth, position);
            
            thumb.style.width = `${finalWidth}%`;
            thumb.style.left = `${finalPosition}%`;
        }
        
        // 拖动开始
        thumb.addEventListener('mousedown', (e) => {
            isDragging = true;
            startX = e.clientX;
            startMin = stockChart.options.scales.x.min;
            startMax = stockChart.options.scales.x.max;
            document.body.style.userSelect = 'none'; // 防止拖动时选中文本
        });
        
        // 拖动结束
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = '';
            }
        });
        
        // 拖动过程
        document.addEventListener('mousemove', (e) => {
            if (!isDragging || !stockChart) return;
            
            const trackRect = track.getBoundingClientRect();
            const deltaX = e.clientX - startX;
            const percentageDelta = (deltaX / trackRect.width) * 100;
            
            const dataPointsCount = stockChart.data.labels.length;
            const range = startMax - startMin;
            // 移除负号，修复拖动方向问题
            const indexDelta = (percentageDelta / 100) * dataPointsCount;
            
            let newMin = startMin + indexDelta;
            let newMax = startMax + indexDelta;
            
            // 边界检查
            if (newMin < 0) {
                newMin = 0;
                newMax = range;
            }
            if (newMax > dataPointsCount - 1) {
                newMax = dataPointsCount - 1;
                newMin = newMax - range;
            }
            
            // 应用新的范围
            stockChart.options.scales.x.min = newMin;
            stockChart.options.scales.x.max = newMax;
            stockChart.update();
            
            // 更新拖动条位置
            updateThumbPosition();
        });
        
        // 点击轨道时移动到对应位置
        track.addEventListener('click', (e) => {
            if (isDragging || !stockChart) return;
            
            const trackRect = track.getBoundingClientRect();
            const clickPosition = ((e.clientX - trackRect.left) / trackRect.width) * 100;
            
            const dataPointsCount = stockChart.data.labels.length;
            const xScale = stockChart.scales.x;
            
            let min = Math.floor(xScale.min);
            let max = Math.ceil(xScale.max);
            
            // 如果没有设置范围，设置默认范围
            if (xScale.min === null || xScale.max === null) {
                min = 0;
                max = Math.min(30, dataPointsCount - 1); // 默认显示30个数据点
            }
            
            const range = max - min;
            const newMin = Math.floor((clickPosition / 100) * dataPointsCount);
            const newMax = Math.min(newMin + range, dataPointsCount - 1);
            
            // 边界检查
            const adjustedMin = Math.max(0, newMin);
            
            // 应用新的范围
            stockChart.options.scales.x.min = adjustedMin;
            stockChart.options.scales.x.max = newMax;
            stockChart.update();
            
            // 更新拖动条位置
            updateThumbPosition();
        });
        
        // 暴露更新方法以便外部调用
        return {
            updatePosition: updateThumbPosition
        };
    }
    
    // 创建图表
    function createChart() {
        // 确保canvas元素存在
        const canvas = document.getElementById('stockChart');
        if (!canvas) {
            console.error('未找到图表canvas元素');
            return;
        }
        
        const ctx = canvas.getContext('2d');
        
        // 按日期排序数据
        const sortedData = [...stockData].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 确保有数据显示
        const displayData = sortedData.length > 0 ? sortedData : generateMockData(30);
        
        // 准备数据
        const dates = displayData.map(item => item.date);
        const financingData = displayData.map(item => item.financingBalance);
        const securitiesData = displayData.map(item => item.securitiesBalance);
        const priceData = displayData.map(item => item.closingPrice);
        
        console.log('图表数据准备完成，日期数量:', dates.length);
        
        // 如果图表已存在，先销毁
        if (stockChart) {
            stockChart.destroy();
            stockChart = null;
        }
        
        // 创建放大按钮
        createZoomButtons();
        
        // 创建X轴拖动条并保存引用
        let dragBar = createDragBar();
        
        // 简化Chart.js配置
        try {
            stockChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: dates,
                    datasets: [
                        {
                            label: '融资余额（亿元）',
                            data: financingData,
                            borderColor: 'blue',
                            backgroundColor: 'rgba(0, 0, 255, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.1,
                            yAxisID: 'y'
                        },
                        {
                            label: '融券余额（万元）',
                            data: securitiesData,
                            borderColor: 'orange',
                            backgroundColor: 'rgba(255, 165, 0, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.1,
                            yAxisID: 'y1'
                        },
                        {
                            label: '收盘价（元）',
                            data: priceData,
                            borderColor: 'green',
                            backgroundColor: 'rgba(0, 128, 0, 0.1)',
                            borderWidth: 2,
                            fill: true,
                            tension: 0.1,
                            yAxisID: 'y2'
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        mode: 'index',
                        intersect: false
                    },
                    animation: {
                        onComplete: function() {
                            // 图表动画完成后更新拖动条位置
                            if (dragBar && typeof dragBar.updatePosition === 'function') {
                                dragBar.updatePosition();
                            }
                        }
                    },
                    plugins: {
                        title: {
                            display: true,
                            text: `${currentStockName}融资融券数据`
                        },
                        legend: {
                            display: true,
                            position: 'top'
                        },
                        tooltip: {
                            mode: 'index',
                            intersect: false
                        }
                    },
                    scales: {
                        x: {
                            title: {
                                display: true,
                                text: '日期'
                            },
                            ticks: {
                                maxRotation: 45,
                                minRotation: 45,
                                autoSkip: true,
                                maxTicksLimit: 12
                            },
                            min: null,
                            max: null
                        },
                        y: {
                            type: 'linear',
                            display: true,
                            position: 'left',
                            title: {
                                display: true,
                                text: '融资余额（亿元）'
                            },
                            grid: {
                                drawOnChartArea: true,
                            }
                        },
                        y1: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: '融券余额（万元）'
                            },
                            grid: {
                                drawOnChartArea: false
                            }
                        },
                        y2: {
                            type: 'linear',
                            display: true,
                            position: 'right',
                            title: {
                                display: true,
                                text: '收盘价（元）'
                            },
                            grid: {
                                drawOnChartArea: false
                            },
                            offset: 80
                        }
                    }
                }
            });
        } catch (error) {
            console.error('创建图表失败:', error);
            showMessage('图表创建失败，请刷新页面重试', 'danger');
        }
    }
  
  // 更新图表数据
    function updateChart() {
        // 按日期排序
        stockData.sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // 重新创建图表
        createChart();
        
        // 更新数据表格
        updateDataTable();
    }
    
    // 显示消息
    function showMessage(text, type = 'info') {
        let msgElement = document.getElementById('msgDiv');
        if (!msgElement) {
            msgElement = document.createElement('div');
            msgElement.id = 'msgDiv';
            msgElement.className = 'alert mt-3';
            msgElement.style.display = 'none';
            document.querySelector('.container').insertBefore(msgElement, document.querySelector('.card'));
        }
        
        msgElement.textContent = text;
        msgElement.className = `alert mt-3 alert-${type}`;
        msgElement.style.display = 'block';
        
        setTimeout(() => {
            msgElement.style.display = 'none';
        }, 3000);
    }
    
    // 获取最新数据按钮事件
    document.getElementById('refreshData').addEventListener('click', fetchLatestData);
    
    // 筛选数据按钮事件
    document.getElementById('filterData').addEventListener('click', filterDataByDateRange);
    
    // 重置筛选按钮事件
    document.getElementById('resetFilter').addEventListener('click', resetFilter);
    
    // 搜索股票按钮事件
    document.getElementById('searchStock').addEventListener('click', searchStock);
    
    // 初始化
    async function init() {
        console.log('开始初始化应用...');
        
        // 确保DOM元素都已加载
        const requiredElements = [
            'startDate', 'endDate', 'stockCode', 
            'refreshData', 'filterData', 'resetFilter', 'searchStock',
            'stockChart', 'dataTableBody'
        ];
        
        let missingElements = [];
        requiredElements.forEach(id => {
            if (!document.getElementById(id)) {
                missingElements.push(id);
            }
        });
        
        if (missingElements.length > 0) {
            console.error('缺少必要的DOM元素:', missingElements);
            showMessage(`页面元素加载不完整，请刷新页面重试`, 'danger');
            return;
        }
        
        // 设置默认日期范围为十年（但首次显示一个月数据）
        document.getElementById('startDate').value = formattedTenYearsAgo;
        document.getElementById('endDate').value = formattedDate;
        
        // 设置默认股票代码
        document.getElementById('stockCode').value = currentStockCode;
        
        // 更新初始标题
        updatePageTitle(currentStockCode, currentStockName);
        
        // 确保Chart.js已加载
        if (typeof Chart === 'undefined') {
            console.error('Chart.js未加载');
            showMessage('图表加载失败，请检查Chart.js是否正确引入', 'danger');
            
            // 尝试手动加载Chart.js
            if (!window.Chart) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
                script.onload = function() {
                    console.log('Chart.js已动态加载');
                    // Chart.js加载成功后再获取数据
                    fetchDataAndInit();
                };
                script.onerror = function() {
                    console.error('动态加载Chart.js失败');
                    showMessage('无法加载图表库，请刷新页面重试', 'danger');
                };
                document.head.appendChild(script);
            }
        } else {
            // Chart.js已加载，直接获取数据
            fetchDataAndInit();
        }
    }
    
    // 单独的数据获取和初始化函数
    async function fetchDataAndInit() {
        try {
            // 直接调用fetchRealData获取数据
            await fetchRealData(currentStockCode);
            console.log('应用初始化完成');
        } catch (error) {
            console.error('初始化数据失败:', error);
            showMessage('初始化数据失败，请刷新页面重试', 'danger');
            
            // 即使API获取失败，也要确保有模拟数据显示图表
            if (stockData.length === 0) {
                stockData = generateMockData(30);
                originalStockData = [...stockData];
                updateDataTable();
                createChart();
            }
        }
    }
    
    // 启动初始化
    init();
});

// 导入Chart.js的缩放插件
// 注意：实际使用时需要在HTML中引入Chart.js的缩放插件
// <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom"></script>