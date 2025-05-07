/**
 * 游戏主逻辑
 */

// 游戏状态
let gameState = null;
let selectedRegion = null;
let hexGrid = null;

// 铁路建设模式变量
let railwayBuildMode = false;
let firstSelectedHex = null;

// DOM元素
const elements = {
    roundNumber: document.getElementById('round-number'),
    turnNumber: document.getElementById('turn-number'),
    phaseInfo: document.getElementById('phase-info'),
    currentPlayer: document.getElementById('current-player'),
    gdpValue: document.getElementById('gdp-value'),
    populationValue: document.getElementById('population-value'),
    regionInfo: document.getElementById('region-info'),
    gameLog: document.getElementById('game-log'),
    nextRound: document.getElementById('next-round'),
    resetGame: document.getElementById('reset-game'),
    buildTown: document.getElementById('build-town'),
    buildRailway: document.getElementById('build-railway'),
    mobilizeTroops: document.getElementById('mobilize-troops'),
    declareWar: document.getElementById('declare-war'),
    actionModal: document.getElementById('action-modal'),
    modalTitle: document.getElementById('modal-title'),
    modalBody: document.getElementById('modal-body'),
    modalConfirm: document.getElementById('modal-confirm'),
    modalCancel: document.getElementById('modal-cancel'),
    closeModal: document.querySelector('.close-modal'),
    gameTitle: document.getElementById('game-title')
};

// 其他函数的占位符...

/**
 * 显示临时消息
 */
function showMessage(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'temp-message';
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 3000);
}

/**
 * 处理六边形格子点击事件
 * @param {number} q 列坐标
 * @param {number} r 行坐标
 * @param {number} s 第三坐标
 */
function onHexClick(q, r, s) {
    console.log(`点击坐标: (${q}, ${r}, ${s})`);
    
    // 如果处于铁路建设模式，处理铁路建设逻辑
    if (railwayBuildMode) {
        handleRailwayBuildClick(q, r, s);
        return;
    }
    
    // 原有的点击处理逻辑
    const clickedCoords = {q: q, r: r, s: s};
    hexGrid.lastClickedCoords = clickedCoords;
    
    let foundRegion = null;
    let clickedTown = null;
    
    const previousSelectedRegion = window.selectedRegion;
    
    if (window.gameState && window.gameState.regions) {
        for (const region of window.gameState.regions) {
            if (region.hex_tiles) {
                const isInRegion = region.hex_tiles.some(tile => 
                    tile.q === q && tile.r === r && tile.s === s
                );
                
                if (isInRegion) {
                    foundRegion = region;
                    
                    if (region.towns) {
                        for (const town of region.towns) {
                            if (town.coords && 
                                town.coords.q === q && 
                                town.coords.r === r && 
                                town.coords.s === s) {
                                clickedTown = town;
                                break;
                            }
                        }
                    }
                    break;
                }
            }
        }
    }
    
    if (foundRegion) {
        handleRegionClick(foundRegion);
        updateClickedHexInfo(clickedCoords, clickedTown);
    } else if (previousSelectedRegion) {
        window.selectedRegion = previousSelectedRegion;
        selectedRegion = previousSelectedRegion;
        
        updateRegionInfo();
        updateActionButtons();
        
        if (hexGrid) {
            for (const hexId in hexGrid.hexagons) {
                hexGrid.hexagons[hexId].element.classList.remove("in-region");
            }
            
            if (previousSelectedRegion.hex_tiles) {
                previousSelectedRegion.hex_tiles.forEach(tile => {
                    const hexKey = `${tile.q},${tile.r},${tile.s}`;
                    if (hexGrid.hexagons[hexKey]) {
                        hexGrid.hexagons[hexKey].element.classList.add("in-region");
                    }
                });
            }
        }
    }
}

/**
 * 处理铁路建设模式下的点击
 */
function handleRailwayBuildClick(q, r, s) {
    console.log(`铁路建设模式点击: (${q}, ${r}, ${s})`);
    
    // 检查点击的地块是否在玩家可控制的区域内
    let validRegion = null;
    if (window.gameState && window.gameState.regions) {
        for (const region of window.gameState.regions) {
            if (region.hex_tiles && canPlayerOperateRegion(region)) {
                const isInRegion = region.hex_tiles.some(tile => 
                    tile.q === q && tile.r === r && tile.s === s
                );
                
                if (isInRegion) {
                    validRegion = region;
                    break;
                }
            }
        }
    }
    
    if (!validRegion) {
        showMessage("所选地块不在您可控制的区域内");
        return;
    }
    
    // 标记选中的地块
    const hexKey = `${q},${r},${s}`;
    if (hexGrid.hexagons[hexKey]) {
        // 为选中的地块添加视觉标记
        const hexElement = hexGrid.hexagons[hexKey].element;
        
        if (!firstSelectedHex) {
            // 第一次选择（起点）
            firstSelectedHex = {q, r, s, region: validRegion};
            hexElement.classList.add("railway-start");
            showMessage("请选择终点地块");
        } else {
            // 第二次选择（终点）
            // 如果选择了同一个地块，取消选择
            if (firstSelectedHex.q === q && firstSelectedHex.r === r && firstSelectedHex.s === s) {
                document.querySelector(".railway-start").classList.remove("railway-start");
                firstSelectedHex = null;
                showMessage("已取消选择起点");
                return;
            }
            
            // 检查是否相邻
            const startQ = firstSelectedHex.q;
            const startR = firstSelectedHex.r;
            
            // 计算q的奇偶性（对负数也正确处理）
            const startIsEven = (startQ % 2 === 0);
            
            // 正确的六边形相邻判断逻辑
            let is_adjacent = false;
            
            // 创建相邻坐标列表
            let neighbors = [];
            if (startIsEven) {
                // 偶数列的相邻坐标
                neighbors = [
                    {q: startQ, r: startR-1},     // 上
                    {q: startQ, r: startR+1},     // 下
                    {q: startQ-1, r: startR},     // 左上
                    {q: startQ+1, r: startR},     // 右上
                    {q: startQ-1, r: startR+1},   // 左下
                    {q: startQ+1, r: startR+1}    // 右下
                ];
            } else {
                // 奇数列的相邻坐标
                neighbors = [
                    {q: startQ, r: startR-1},     // 上
                    {q: startQ, r: startR+1},     // 下
                    {q: startQ-1, r: startR-1},   // 左上
                    {q: startQ+1, r: startR-1},   // 右上
                    {q: startQ-1, r: startR},     // 左下
                    {q: startQ+1, r: startR}      // 右下
                ];
            }
            
            // 检查终点是否在相邻坐标列表中
            is_adjacent = neighbors.some(n => n.q === q && n.r === r);
            
            // 移除起点标记
            document.querySelector(".railway-start").classList.remove("railway-start");
            
            // 退出铁路建设模式
            railwayBuildMode = false;
            
            if (!is_adjacent) {
                // 不相邻，显示错误信息
                showModal('建设失败', '<p>您选择的地块不符合建设要求，不是相邻的地块</p>', () => {
                    closeModal();
                });
                
                firstSelectedHex = null;
                return;
            }
            
            // 相邻，询问用户是否确认建设
            const confirmContent = `
                <div class="info-text">
                    <p>您是否确定在(${startQ},${startR})与(${q},${r})之间建设铁路？</p>
                    <p>消耗: <strong>30 GDP</strong></p>
                </div>
            `;
            
            showModal('确认建设铁路', confirmContent, () => {
                // 执行建设
                buildRailway(
                    validRegion.id,
                    {q: startQ, r: startR, s: firstSelectedHex.s},
                    {q, r, s}
                );
                
                firstSelectedHex = null;
            });
        }
    }
}

/**
 * 显示建造铁路模态框
 */
function showBuildRailwayModal() {
    if (!window.selectedRegion) {
        alert("请先选择一个区域");
        return;
    }
    
    console.log("开始铁路建设流程");
    
    // 弹出提示框
    const content = `
        <div class="info-text">
            <p>请选择你想建造铁路的两个相邻地块</p>
            <p>消耗: <strong>30 GDP</strong></p>
        </div>
    `;
    
    showModal('建造铁路', content, () => {
        // 进入铁路建设模式
        railwayBuildMode = true;
        firstSelectedHex = null;
        
        // 关闭模态框
        closeModal();
        
        // 显示引导提示
        showMessage("请选择铁路起点");
    });
} 