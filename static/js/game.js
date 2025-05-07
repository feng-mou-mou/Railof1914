/**
 * 游戏主逻辑
 */

// 游戏状态
let gameState = null;
let selectedRegion = null;
let hexGrid = null;

// 角色相关变量
let playerRole = null;
let roleAbilities = {
    germany: {
        name: "德意志帝国",
        image: "/static/images/German_role.png",
        quote: "铁与血的政策将铸就我们的伟大帝国",
        abilities: [
            {
                id: "blitz_raid",
                name: "闪电突袭",
                description: "提高30%运输能力，持续5回合",
                oneTimeUse: false,
                duration: 5,
                used: false,
                duration: 5,
                turnsLeft: 0
            },
            {
                id: "emergency_repairs",
                name: "Emergency Repairs",
                description: "Temporarily restore destroyed tracks (5 turns) at double resource cost",
                used: false,
                duration: 5,
                turnsLeft: 0
            }
        ]
    },
    allies: {
        name: "French Commander-in-Chief, Marne Defense Architect",
        image: "/static/images/French_role.png",
        quote: "Let German trains bring soldiers - they'll haul corpses back!",
        abilities: [
            {
                id: "elastic_defense",
                name: "Elastic Defense",
                description: "50% faster railway repairs (5 turns)",
                used: false,
                duration: 5,
                turnsLeft: 0
            },
            {
                id: "taxi_miracle",
                name: "Taxi Miracle Event",
                description: "Instantly reinforce frontline troops (single use, Paris departure only)",
                used: false,
                oneTimeUse: true
            }
        ]
    }
};

// 模式变量
let railwayBuildMode = false;    // 铁路建设模式
let buildingTownMode = false;    // 城镇建设模式
let troopMobilizeMode = false;   // 军队动员模式
let firstSelectedHex = null;

// 升级城镇模式变量
let upgradeTownMode = false;
let selectedTowns = [];
let currentUpgradeType = null; // 'village' 或 'small_city'

// DOM元素
const elements = {
    roundNumber: document.getElementById('round-number'),
    phaseInfo: document.getElementById('phase-info'),
    currentPlayer: document.getElementById('current-player'),
    // 新的GDP和人口元素引用
    germanyGdpValue: document.getElementById('germany-gdp-value'),
    germanyPopulationValue: document.getElementById('germany-population-value'),
    alliesGdpValue: document.getElementById('allies-gdp-value'),
    alliesPopulationValue: document.getElementById('allies-population-value'),
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
    gameTitle: document.getElementById('game-title'),
    roleIcon: document.getElementById('role-icon'),
    roleModal: document.getElementById('role-modal'),
    roleModalTitle: document.getElementById('role-modal-title'),
    roleModalBody: document.getElementById('role-modal-body'),
    closeRoleModal: document.querySelector('.close-role-modal')
};

// 在initGame函数中初始化
window.lastUpgradedTown = null;
window.lastUpgradeTime = 0;

// AI相关变量
let aiEnabled = true; // 是否启用AI
let aiThinking = false; // AI是否正在思考
let aiDifficulty = 'medium'; // AI难度：easy, medium, hard
let playerReady = false; // 玩家是否准备好
let aiReady = false; // AI是否准备好

let eventShown = false; // 新增变量，防止多次弹出

/**
 * 初始化游戏
 */
function initGame() {
    // 检查是否已经初始化
    if (window.gameInitialized) {
        console.log("游戏已经初始化，跳过重复初始化");
        return;
    }
    
    console.log("开始初始化游戏...");
    window.gameInitialized = true;
    
    // 初始化游戏变量
    gamePhase = "construction";
    selectedRegion = null;
    selectedTown = null;
    selectedHex = null;
    isMobilizing = false;
    isAttacking = false;
    window.railways = []; // 初始化空的铁路数组
    window.gameState = null;
    mobilizationSource = null;
    mobilizationTarget = null;
    townUpgradeSelected = null;
    townUpgradeType = null;
    errorRetries = 0;
    attackSource = null;
    attackTarget = null;

    // 初始化AI相关变量
    window.aiEnabled = true;
    window.aiThinking = false;
    window.aiDifficulty = "medium";
    window.playerReady = false;
    window.aiReady = false;

    // 从URL参数中获取玩家角色
    const urlParams = new URLSearchParams(window.location.search);
    const faction = urlParams.get('faction') || 'germany';
    window.playerRole = faction === 'germany' ? 'GE' : 'FR'; // 转换角色格式
    
    // 初始化玩家角色图标
    initPlayerRole(faction);
    
    // 创建hexGrid对象并初始化地图
    if (!window.hexGrid) {
        console.log("创建六边形网格...");
        const mapContainer = document.getElementById('game-map');
        if (mapContainer) {
            // 同时设置window.hexGrid和全局变量hexGrid
            window.hexGrid = new HexGrid('game-map', 40);
            hexGrid = window.hexGrid; // 确保全局变量与window属性同步
            
            if (hexGrid) {
                // 先初始化，再设置回调
        hexGrid.init();
                console.log("设置六边形点击事件回调...");
        hexGrid.setHexClickCallback(onHexClick);
                console.log("六边形网格初始化成功!");
            } else {
                console.error("HexGrid构造函数返回null");
            }
        } else {
            console.error("找不到地图容器 'game-map'");
        }
    } else {
        console.log("六边形网格已存在，重用现有网格");
    }
    
    // 设置事件监听器
    setupEventListeners();
    
    // 初始化AI难度
    initAIDifficulty();
    
    // 获取初始游戏状态
    fetchGameState();
    
    console.log("游戏初始化完成!");
}

/**
 * 设置事件监听器
 */
function setupEventListeners() {
    // 绑定回合切换按钮事件
    const nextRoundBtn = document.getElementById('next-round-btn') || document.getElementById('next-round');
    if (nextRoundBtn) {
        // 移除现有的事件监听器
        const newButton = nextRoundBtn.cloneNode(true);
        nextRoundBtn.parentNode.replaceChild(newButton, nextRoundBtn);
        
        // 添加新的事件监听器
        newButton.addEventListener('click', function() {
            // 退出所有建设模式
            if (upgradeTownMode) exitTownUpgradeMode();
            if (railwayBuildMode) {
                railwayBuildMode = false;
                firstSelectedHex = null;
                const allMarks = document.querySelectorAll(".railway-start, .railway-end");
                allMarks.forEach(element => {
                    element.classList.remove("railway-start", "railway-end");
                });
            }
            if (buildingTownMode) buildingTownMode = false;
            if (troopMobilizeMode) troopMobilizeMode = false;
            
            // 根据AI模式选择不同的处理方式
            if (aiEnabled) {
                readyForNextRound();
            } else {
                nextRound();
            }
        });
    }
    
    // 绑定重置游戏按钮事件
    const resetGameBtn = document.getElementById('reset-game-btn') || document.getElementById('reset-game');
    if (resetGameBtn) {
        resetGameBtn.addEventListener('click', resetGame);
    }
    
    // 绑定建设城镇按钮事件
    const buildTownBtn = document.getElementById('build-town-btn') || document.getElementById('build-town');
    if (buildTownBtn) {
        buildTownBtn.addEventListener('click', showBuildTownModal);
    }
    
    // 绑定建设铁路按钮事件
    const buildRailwayBtn = document.getElementById('build-railway-btn') || document.getElementById('build-railway');
    if (buildRailwayBtn) {
        buildRailwayBtn.addEventListener('click', showBuildRailwayModal);
    }
    
    // 绑定动员军队按钮事件
    const mobilizeTroopsBtn = document.getElementById('mobilize-troops-btn') || document.getElementById('mobilize-troops');
    if (mobilizeTroopsBtn) {
        mobilizeTroopsBtn.addEventListener('click', showMobilizeTroopsModal);
    }
    
    // 绑定宣战按钮事件
    const declareWarBtn = document.getElementById('declare-war-btn') || document.getElementById('declare-war');
    if (declareWarBtn) {
        declareWarBtn.addEventListener('click', showDeclareWarModal);
    }
    
    // 绑定快速结算按钮事件
    const quickSettlementBtn = document.getElementById('quick-settlement');
    if (quickSettlementBtn) {
        quickSettlementBtn.addEventListener('click', showQuickSettlementModal);
    }
    
    // 绑定关闭模态窗按钮事件
    const closeModalButtons = document.querySelectorAll('.close-modal-btn, .close-modal');
    closeModalButtons.forEach(button => {
        button.addEventListener('click', closeModal);
    });
    
    // 角色图标点击事件
    const roleIcon = document.getElementById('role-icon');
    if (roleIcon) {
        roleIcon.addEventListener('click', showRoleModal);
    } else if (elements.roleIcon) {
        elements.roleIcon.addEventListener('click', showRoleModal);
    }
    
    // 角色弹窗关闭按钮
    const closeRoleModalBtn = document.querySelector('.close-role-modal');
    if (closeRoleModalBtn) {
        closeRoleModalBtn.addEventListener('click', closeRoleModal);
    } else if (elements.closeRoleModal) {
        elements.closeRoleModal.addEventListener('click', closeRoleModal);
    }
    
    // 升级城镇按钮
    const upgradeTownButton = document.getElementById('upgrade-town');
    if (upgradeTownButton) {
        upgradeTownButton.addEventListener('click', showUpgradeTownModal);
    }
    
    // 添加ESC键退出各种模式的功能
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            console.log('按下ESC键，退出当前模式');
            // 退出所有建设模式
            if (upgradeTownMode) {
                exitTownUpgradeMode();
                showMessage('已退出城镇升级模式');
            } else if (railwayBuildMode) {
                railwayBuildMode = false;
                firstSelectedHex = null;
                // 清除所有标记
                const allMarks = document.querySelectorAll(".railway-start, .railway-end");
                allMarks.forEach(element => {
                    element.classList.remove("railway-start", "railway-end");
                });
                showMessage('已退出铁路建设模式');
            } else if (buildingTownMode) {
                buildingTownMode = false;
                showMessage('已退出城镇建设模式');
            } else if (troopMobilizeMode) {
                troopMobilizeMode = false;
                showMessage('已退出军队动员模式');
            }
            
            // 如果模态框是打开的，关闭它
            const actionModal = document.getElementById('action-modal');
            if (actionModal && actionModal.style.display === 'block') {
                closeModal();
            } else if (elements.actionModal && elements.actionModal.style.display === 'block') {
                closeModal();
            }
            
            // 如果角色弹窗是打开的，关闭它
            const roleModal = document.getElementById('role-modal');
            if (roleModal && roleModal.style.display === 'block') {
                closeRoleModal();
            } else if (elements.roleModal && elements.roleModal.style.display === 'block') {
                closeRoleModal();
            }
        }
    });
    
    // 添加点击地图空白区域退出升级模式的功能
    const gameMap = document.getElementById('game-map');
    if (gameMap) {
        gameMap.addEventListener('click', (event) => {
            // 判断点击的是否是SVG背景而不是六边形
            if (event.target.tagName === 'svg' || event.target.id === 'svg-container') {
                console.log('点击了地图空白区域');
                // 检查是否在升级模式中
                if (upgradeTownMode) {
                    exitTownUpgradeMode();
                    showMessage('已退出城镇升级模式');
                }
            }
        });
    }
    
    console.log("事件监听器设置完成");
}

/**
 * 检查玩家是否可以操作指定区域
 * @param {Object} region 区域信息
 * @returns {boolean} 是否可操作
 */
function canPlayerOperateRegion(region) {
    try {
        // 基本检查
        if (!region) {
            console.log("无法操作：区域不存在");
            return false;
        }
        
        if (!window.gameState) {
            console.log("无法操作：游戏状态不存在");
            return false;
        }
        
        if (!region.id) {
            console.log("无法操作：区域ID不存在");
            return false;
        }
    
    const currentPlayer = window.gameState.current_player;
        if (!currentPlayer) {
            console.log("无法操作：当前玩家未定义");
            return false;
        }
        
        // 提取区域前缀（FR, GE, BE）
        if (region.id.length < 2) {
            console.log(`无法操作：区域ID格式不正确 ${region.id}`);
            return false;
        }
        
    const regionPrefix = region.id.substring(0, 2);
        
        // 标准化玩家代码 - 同时支持代码形式和显示名称形式
        let normalizedPlayerCode;
        if (currentPlayer === 'GE' || currentPlayer === '德军') {
            normalizedPlayerCode = 'GE';
        } else if (currentPlayer === 'FR' || currentPlayer === '协约国') {
            normalizedPlayerCode = 'FR';
        } else {
            console.log(`无法操作：未知的玩家代码 ${currentPlayer}`);
            return false;
        }
        
        // 使用标准化后的代码比较
        if (normalizedPlayerCode === 'GE') {
            // 德国玩家可以操作GE和BE前缀的区域
            const canOperate = (regionPrefix === 'GE' || regionPrefix === 'BE');
            console.log(`玩家${currentPlayer}(${normalizedPlayerCode})${canOperate ? '可以' : '不能'}操作${regionPrefix}区域`);
            return canOperate;
        } else if (normalizedPlayerCode === 'FR') {
            // 法国玩家只能操作FR前缀的区域
            const canOperate = (regionPrefix === 'FR');
            console.log(`玩家${currentPlayer}(${normalizedPlayerCode})${canOperate ? '可以' : '不能'}操作${regionPrefix}区域`);
            return canOperate;
        }
        
        return false;
    } catch (error) {
        console.error("检查区域操作权限时出错:", error);
        return false;
    }
}

/**
 * 处理区域点击事件
 * @param {Object} region 被点击的区域
 */
function handleRegionClick(region) {
    if (!region) return;
    
    console.log("处理区域点击:", region.id);
    
    // 检查玩家是否可以操作该区域
    if (!canPlayerOperateRegion(region)) {
        showMessage(`你不能操作${region.name}区域，因为它不属于你的阵营。`);
        return;
    }
    
    // 存储当前选择的区域
    window.selectedRegion = region;
    selectedRegion = region;
    
    // 更新区域信息显示
    updateRegionInfo();
    
    // 更新可用操作按钮
    updateActionButtons();
    
    // 高亮显示选中的区域
    console.log("尝试高亮区域:", region.id);
    
    if (hexGrid) {
        // 彻底清除所有区域高亮
        console.log("清除所有高亮");
        clearAllHighlights();
        
        // 获取区域的前缀以决定高亮颜色类名
        const regionPrefix = region.id.substring(0, 2);
        let regionClass = "";
        let borderColor = ""; 
        
        switch (regionPrefix) {
            case "FR":
                regionClass = "region-fr-highlight";
                borderColor = "#0072B5"; // 法国蓝色
                break;
            case "BE":
                regionClass = "region-be-highlight";
                borderColor = "#FF9999"; // 比利时粉红色
                break;
            case "GE":
                regionClass = "region-ge-highlight";
                borderColor = "#D62728"; // 德国红色
                break;
            default:
                regionClass = "in-region";
                borderColor = "#333333"; // 默认边框颜色
        }
        
        // 为当前选择的区域添加高亮
        if (region.hex_tiles && region.hex_tiles.length > 0) {
            // 打印区域内格子数量，帮助调试
            console.log(`区域 ${region.id} 包含 ${region.hex_tiles.length} 个格子`);
            
            // 创建一个集合来跟踪边缘六边形
            const edgeHexes = new Set();
            
            // 创建一个二维坐标到六边形的映射，用于更快找到六边形
            const hexMapByCoords = {};
            for (const hexId in hexGrid.hexagons) {
                const hex = hexGrid.hexagons[hexId];
                // 使用二维坐标作为键
                const key = `${hex.q},${hex.r}`;
                hexMapByCoords[key] = hex;
            }
            
            let highLightedCount = 0;
            
            // 遍历并处理区域内所有格子
            region.hex_tiles.forEach(tile => {
                // 确保坐标是整数
                const q = parseInt(tile.q);
                const r = parseInt(tile.r);
                const coordKey = `${q},${r}`;
                const hex = hexMapByCoords[coordKey];
                
                if (hex && hex.element) {
                    highLightedCount++;
                    
                    // 应用区域内样式
                    hex.element.classList.add("in-region");
                    
                    // 设置边框颜色
                    hex.element.style.stroke = borderColor;
                    hex.element.style.strokeWidth = '3px';
                    
                    console.log(`高亮格子: (${q}, ${r}) - 添加 in-region 类`);
                    
                    // 检查是否是边缘格子
                    const isEdge = isEdgeHex(tile, region.hex_tiles);
                    if (isEdge) {
                        console.log(`边缘格子: (${q}, ${r}) - 添加 ${regionClass} 类`);
                        hex.element.classList.add(regionClass);
                        edgeHexes.add(coordKey);
                    }
                } else {
                    console.warn(`找不到六边形: (${q}, ${r})`);
                }
            });
            
            console.log(`已添加${highLightedCount}个格子高亮，其中${edgeHexes.size}个边缘六边形高亮`);
        } else {
            console.warn(`区域 ${region.id} 没有六边形格子或格子数为0`);
        }
    } else {
        console.error("hexGrid对象未定义，无法高亮区域");
    }
}

/**
 * 检查六边形是否为区域边缘
 * @param {Object} hex 需要检查的六边形
 * @param {Array} allHexes 区域内的所有六边形
 * @returns {boolean} 是否为边缘六边形
 */
function isEdgeHex(hex, allHexes) {
    // 获取六边形在odd-r坐标系中的邻居坐标
    const neighbors = getNeighborCoords(hex.q, hex.r);
    
    // 检查是否有至少一个邻居不在区域内
    return neighbors.some(neighbor => {
        // 检查这个邻居坐标是否不在区域内的任何六边形中
        return !allHexes.some(tile => 
            tile.q === neighbor.q && tile.r === neighbor.r
        );
    });
}

/**
 * 获取odd-r坐标系中六边形的邻居坐标
 * @param {number} q 列坐标
 * @param {number} r 行坐标
 * @returns {Array} 邻居坐标数组
 */
function getNeighborCoords(q, r) {
    // 确保坐标是数字类型
    q = parseInt(q);
    r = parseInt(r);
    
    // 检查odd-r坐标系中的行是否为奇数
    const isOdd = q % 2 !== 0;
    
    // 根据奇偶行确定邻居的相对坐标
    // odd-r坐标系中，奇数列的邻居与偶数列的邻居在垂直方向上有偏移
    let directions;
    
    if (isOdd) {
        // 奇数列 (q is odd)
        directions = [
            {q: 1, r: 0},   // 右
            {q: 1, r: 1},   // 右下
            {q: 0, r: 1},   // 下
            {q: -1, r: 1},  // 左下
            {q: -1, r: 0},  // 左
            {q: 0, r: -1}   // 上
        ];
    } else {
        // 偶数列 (q is even)
        directions = [
            {q: 1, r: 0},   // 右
            {q: 0, r: 1},   // 右下
            {q: -1, r: 0},  // 左下
            {q: -1, r: -1}, // 左
            {q: 0, r: -1},  // 左上
            {q: 1, r: -1}   // 右上
        ];
    }
    
    // 根据方向计算邻居的绝对坐标
    return directions.map(dir => ({
        q: q + dir.q,
        r: r + dir.r
    }));
}

/**
 * 处理六边形格子点击事件
 * @param {number} q 列坐标
 * @param {number} r 行坐标
 * @param {number} s 第三坐标
 */
function onHexClick(q, r, s) {
    console.log(`点击坐标: (${q}, ${r}, ${s}), 铁路建设模式: ${railwayBuildMode}, 升级城镇模式: ${upgradeTownMode}`);
    
    // 如果处于铁路建设模式，处理铁路建设逻辑
    if (railwayBuildMode) {
        handleRailwayBuildClick(q, r, s);
        return;
    }
    
    // 清除所有的单格高亮效果
    clearSingleHexHighlight();
    
    // 确保坐标是整数类型
    q = parseInt(q);
    r = parseInt(r);
    s = parseInt(s);
    
    // 存储点击坐标
    const clickedCoords = {q: q, r: r, s: s};
    hexGrid.lastClickedCoords = clickedCoords;
    
    // 高亮点击的格子
    const hexKey = `${q},${r},${s}`;
    if (hexGrid.hexagons[hexKey]) {
        hexGrid.hexagons[hexKey].element.classList.add("clicked-hex-highlight");
    }
    
    // 查找该坐标所在的区域
    let foundRegion = null;
    let clickedTown = null;
    
    // 保存用户之前选择的区域，以防找不到新的区域时恢复
    const previousSelectedRegion = window.selectedRegion;
    
    if (window.gameState && window.gameState.regions) {
        for (const region of window.gameState.regions) {
            if (region.hex_tiles) {
                // 使用二维坐标查找是否在区域内，不依赖s坐标
                const isInRegion = region.hex_tiles.some(tile => 
                    parseInt(tile.q) === q && parseInt(tile.r) === r
                );
                
                if (isInRegion) {
                    console.log(`该坐标在区域 ${region.id} 内`);
                    foundRegion = region;
                    
                    // 检查是否点击了城镇
                    if (region.towns) {
                        // 先检查是否是合并城镇的格子
                        if (region.hex_tiles) {
                            // 查找当前坐标上的城镇名称
                            const clickedHex = region.hex_tiles.find(hex => 
                                hex.q === q && hex.r === r && (hex.s === s || hex.s === undefined)
                            );
                            
                            if (clickedHex && clickedHex.town) {
                                // 获取该格子上的城镇名称
                                const townName = typeof clickedHex.town === 'object' ? 
                                                clickedHex.town.name : clickedHex.town;
                                
                                console.log(`检测到格子上的城镇: ${townName}`);
                                
                                // 从区域中找到完整的城镇对象
                                const townObj = region.towns.find(t => t.name === townName);
                                if (townObj) {
                                    console.log(`找到城镇对象: ${townObj.name}`);
                                    clickedTown = townObj;
                                    
                                    // 找出所有引用该城镇的格子并高亮它们
                                    const allTownHexes = [];
                                    for (const hex of region.hex_tiles) {
                                        const hexTownName = typeof hex.town === 'object' ? 
                                                          hex.town.name : hex.town;
                                        if (hexTownName === townName) {
                                            allTownHexes.push(hex);
                                        }
                                    }
                                    
                                    // 高亮所有引用该城镇的格子
                                    for (const hex of allTownHexes) {
                                        const otherHexKey = `${hex.q},${hex.r},${hex.s || -(hex.q + hex.r)}`;
                                        if (hexGrid.hexagons[otherHexKey]) {
                                            hexGrid.hexagons[otherHexKey].element.classList.add("clicked-hex-highlight");
                                            console.log(`高亮城镇格子: ${otherHexKey}`);
                                        }
                                    }
                                }
                            } else {
                                // 如果没有直接找到城镇，尝试通过坐标匹配
                                for (const town of region.towns) {
                                    // 使用坐标匹配
                                    if (town.coords && 
                                        parseInt(town.coords.q) === q && 
                                        parseInt(town.coords.r) === r && 
                                        (parseInt(town.coords.s) === s || town.coords.s === undefined)) {
                                        clickedTown = town;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    break;
                }
            }
        }
    }
    
    // 如果在任何建设模式下点击了城镇，执行相应操作
    // 升级城镇模式
    if (upgradeTownMode && clickedTown) {
        handleTownUpgradeClick(q, r, s, clickedTown);
        return;
    }
    // 建造城镇模式
    else if (buildingTownMode && clickedTown) {
        console.log("点击了已有城镇，但处于建造城镇模式");
        return;
    }
    // 建造铁路模式
    else if (railwayBuildMode && clickedTown) {
        console.log("点击了已有城镇，但处于建造铁路模式");
        return;
    }
    // 动员军队模式
    else if (troopMobilizeMode && clickedTown) {
        console.log("点击了已有城镇，但处于动员军队模式");
        return;
    }
    
    if (foundRegion) {
        // 处理区域点击
        handleRegionClick(foundRegion);
        
        // 更新点击的格子信息
        updateClickedHexInfo(clickedCoords, clickedTown);
    } else {
        console.warn(`坐标(${q},${r},${s})不在任何区域内，尝试恢复之前选择的区域: ${previousSelectedRegion ? previousSelectedRegion.id : '无'}`);
        
        // 如果没有找到新区域，保持之前选择的区域
        if (previousSelectedRegion) {
            window.selectedRegion = previousSelectedRegion;
            selectedRegion = previousSelectedRegion;
            updateRegionInfo();
            updateActionButtons();
            
            // 更新区域高亮
            if (hexGrid) {
                // 彻底清除所有高亮
                clearAllHighlights();
                
                const regionPrefix = previousSelectedRegion.id.substring(0, 2);
                let regionClass = "";
                let borderColor = "";
                
                switch (regionPrefix) {
                    case "FR": 
                        regionClass = "region-fr-highlight"; 
                        borderColor = "#0072B5"; // 法国蓝色
                        break;
                    case "BE": 
                        regionClass = "region-be-highlight"; 
                        borderColor = "#FF9999"; // 比利时粉红色
                        break;
                    case "GE": 
                        regionClass = "region-ge-highlight"; 
                        borderColor = "#D62728"; // 德国红色
                        break;
                    default: 
                        regionClass = "in-region";
                        borderColor = "#333333"; // 默认边框颜色
                }
                
                if (previousSelectedRegion.hex_tiles) {
                    // 创建二维坐标映射
                    const hexMapByCoords = {};
                    for (const hexId in hexGrid.hexagons) {
                        const hex = hexGrid.hexagons[hexId];
                        const key = `${hex.q},${hex.r}`;
                        hexMapByCoords[key] = hex;
                    }
                    
                    const edgeHexes = new Set();
                    let highLightedCount = 0;
                    
                    previousSelectedRegion.hex_tiles.forEach(tile => {
                        // 确保坐标是整数
                        const tileQ = parseInt(tile.q);
                        const tileR = parseInt(tile.r);
                        // 使用二维坐标查找
                        const coordKey = `${tileQ},${tileR}`;
                        const hex = hexMapByCoords[coordKey];
                        
                        if (hex) {
                            highLightedCount++;
                            // 先标记所有格子为区域内格子
                            hex.element.classList.add("in-region");
                            
                            // 确保边框颜色保持不变
                            hex.element.style.stroke = borderColor;
                            hex.element.style.strokeWidth = '3px';
                            
                            // 设置填充透明度
                            hex.element.style.fill = 'rgba(255,255,255,0.4)';
                            
                            // 为背景图片添加明亮效果
                            const bgImage = hex.group.querySelector(".hex-background");
                            if (bgImage) {
                                bgImage.style.filter = 'brightness(1.2)';
                            }
                            
                            // 然后检查是否是边缘格子
                            const isEdge = isEdgeHex(tile, previousSelectedRegion.hex_tiles);
                            if (isEdge) {
                                hex.element.classList.add(regionClass);
                                edgeHexes.add(coordKey);
                            }
                        }
                    });
                    
                    console.log(`恢复区域高亮: ${previousSelectedRegion.id}, 已添加${highLightedCount}个格子高亮，其中${edgeHexes.size}个边缘六边形高亮`);
                }
            }
        }
    }
}

/**
 * 清除所有单格高亮效果
 */
function clearSingleHexHighlight() {
    const highlightedHexes = document.querySelectorAll(".clicked-hex-highlight");
    highlightedHexes.forEach(element => {
        element.classList.remove("clicked-hex-highlight");
    });
}

/**
 * 更新点击的格子信息
 * @param {Object} coords 坐标
 * @param {Object} town 城镇信息（如果有）
 */
function updateClickedHexInfo(coords, town) {
    const infoContainer = document.getElementById('clicked-info');
    if (!infoContainer) return;
    
    if (town) {
        // 根据城镇等级确定GDP产出
        let gdpOutput = 0;
        if (town.level === 'village') {
            gdpOutput = 20;
        } else if (town.level === 'small_city') {
            gdpOutput = 50;
        } else if (town.level === 'large_city') {
            gdpOutput = 120;
        }
        
        // 转换城镇等级为中文显示
        const levelMap = {
            'village': '村落',
            'small_city': '小城市',
            'large_city': '大城市'
        };
        const displayLevel = levelMap[town.level] || town.level;
        
        // 确保人口数据有效
        const population = town.population !== undefined ? town.population : 0;
        
        // 显示城镇信息
        infoContainer.innerHTML = `
            <div class="clicked-town-info">
                <p><strong>${town.name}</strong> (${displayLevel})</p>
                <p>所属: ${town.owner}</p>
                <p>人口: ${population} 万</p>
                <p>GDP: ${gdpOutput} 万/回合</p>
                <p>位置: (${coords.q}, ${coords.r}, ${coords.s})</p>
                <p>已动员: ${town.mobilized || 0} 万兵力</p>
            </div>
        `;
    } else {
        // 显示空地信息
        infoContainer.innerHTML = `
            <div class="clicked-hex-info">
                <p><strong>空地</strong></p>
                <p>可以在此建造新城镇</p>
                <p>位置: (${coords.q}, ${coords.r}, ${coords.s})</p>
            </div>
        `;
    }
}

/**
 * 更新区域信息
 */
function updateRegionInfo() {
    const regionInfoElement = document.getElementById('region-info');
    if (!regionInfoElement) return;
    
    if (window.selectedRegion) {
        const region = window.selectedRegion;
        
        // 检查游戏状态是否存在
        if (!window.gameState) {
            console.error("游戏状态不存在，尝试重新获取");
            fetchGameState(); // 尝试重新获取游戏状态
            regionInfoElement.innerHTML = `<p>正在加载区域信息，请稍候...</p>`;
            return;
        }
        
        // 检查玩家是否可以操作该区域
        const canOperate = canPlayerOperateRegion(region);
        
        // 获取当前玩家的派系
        const currentFaction = window.gameState.current_player;
        
        // 检查是否是冲突区域
        const isConflictRegion = region.id === 'FR-3' || region.id === 'GE-3';
        
        let html = `
            <h3>${region.name} (${region.id})</h3>
            ${isConflictRegion ? `<p class="conflict-region">冲突地区</p>` : ''}
            <p>地块数: ${region.hex_tiles ? region.hex_tiles.length : 0}</p>
            <p>城镇数: ${region.towns ? region.towns.length : 0}</p>
        `;
        
        // 如果是冲突区域，显示所有阵营的已到达兵力
        if (isConflictRegion && window.gameState.arrived_forces) {
            html += `
                <div class="conflict-forces">
                    <h4>已到达兵力</h4>
            `;
            
            // 显示所有阵营的兵力
            for (const [faction, force] of Object.entries(window.gameState.arrived_forces)) {
                if (force > 0) { // 只显示有兵力的阵营
                    const factionColor = faction === '德军' ? '#3498db' : '#e74c3c';
                    html += `
                        <p>
                            <span style="color: ${factionColor};">${faction}</span>: 
                            <strong>${force}万</strong>
                        </p>
                    `;
                }
            }
            
            html += `</div>`;
        }
        
        // 显示区域内的城镇列表
        if (region.towns && region.towns.length > 0) {
            html += `<div class="town-list"><h4>该区域城镇列表:</h4><ul>`;
            
            region.towns.forEach(town => {
                const isOwnTown = town.owner === window.gameState.current_player;
                const townClass = isOwnTown ? 'own-town' : 'enemy-town';
                
                // 预期GDP映射表
                const gdpMap = {
                    'village': 20,
                    'small_city': 50,
                    'large_city': 120
                };
                
                // 获取预期GDP值（建设完成后的GDP）
                const expectedGdp = gdpMap[town.level] || 0;
                
                // 显示城镇中文名称
                const levelName = {
                    'village': '村落',
                    'small_city': '小城市',
                    'large_city': '大城市'
                }[town.level] || town.level;
                
                html += `
                    <li class="${townClass}">
                        ${town.name} (${levelName}) - 
                        人口: ${town.population}万, 
                        GDP: ${expectedGdp}万/回合
                        ${town.is_under_construction ? ' <span class="under-construction">[建设中]</span>' : ''}
                    </li>
                `;
            });
            
            html += `</ul></div>`;
        } else {
            html += `<p>该区域暂无城镇</p>`;
        }
        
        // 如果玩家不能操作该区域，显示提示
        if (!canOperate) {
            html += `
                <div class="info-text">
                    <p>注意: 该区域不属于你的阵营，无法进行操作。</p>
                </div>
            `;
        }
        
        regionInfoElement.innerHTML = html;
    } else {
        regionInfoElement.innerHTML = `<p>请点击地图选择一个区域</p>`;
    }
}

/**
 * 更新玩家资源显示
 */
function updatePlayerResources() {
    try {
        if (!gameState || !gameState.players) {
            console.log("更新资源显示失败：游戏状态或玩家数据不存在");
            return;
        }
        
        console.log("更新资源显示，所有玩家数据:", gameState.players);
        
        // 获取德军和协约国的资源数据
        let germanyResources = null;
        let alliesResources = null;
        
        // 遍历所有玩家，查找德军和协约国
        for (const [key, player] of Object.entries(gameState.players)) {
            if (key === 'GE' || key === '德军' || 
                (typeof key === 'string' && key.includes('德'))) {
                germanyResources = player;
                console.log("找到德军资源:", key, player);
            } else if (key === 'FR' || key === '协约国' || 
                       (typeof key === 'string' && (key.includes('法') || key.includes('协')))) {
                alliesResources = player;
                console.log("找到协约国资源:", key, player);
            }
        }
        
        // 更新德军资源显示
        if (germanyResources) {
            if (elements.germanyGdpValue) {
                elements.germanyGdpValue.textContent = germanyResources.gdp || 0;
            }
            if (elements.germanyPopulationValue) {
                elements.germanyPopulationValue.textContent = germanyResources.population || 0;
            }
        } else {
            console.log("未找到德军资源数据");
            if (elements.germanyGdpValue) elements.germanyGdpValue.textContent = "0";
            if (elements.germanyPopulationValue) elements.germanyPopulationValue.textContent = "0";
        }
        
        // 更新协约国资源显示
        if (alliesResources) {
            if (elements.alliesGdpValue) {
                elements.alliesGdpValue.textContent = alliesResources.gdp || 0;
            }
            if (elements.alliesPopulationValue) {
                elements.alliesPopulationValue.textContent = alliesResources.population || 0;
            }
        } else {
            console.log("未找到协约国资源数据");
            if (elements.alliesGdpValue) elements.alliesGdpValue.textContent = "0";
            if (elements.alliesPopulationValue) elements.alliesPopulationValue.textContent = "0";
        }
    } catch (error) {
        console.error("更新玩家资源时出错:", error);
    }
}

/**
 * 更新游戏状态显示
 */
function updateGameStateUI(gameState) {
    try {
        // 验证游戏状态是否有效
    if (!gameState) {
        gameState = window.gameState;
    }
    
    if (!gameState) {
        console.error("更新UI失败：无有效游戏状态");
        return;
    }
    
        // 确保全局和局部变量保持同步
        window.gameState = gameState;
        
        // 更新回合信息，带有默认值以防属性不存在
        try {
    if (elements.roundNumber) {
        elements.roundNumber.textContent = gameState.round || "1";
    }
    
    if (elements.phaseInfo) {
        elements.phaseInfo.textContent = gameState.phase || "建设阶段";
    }
    
    if (elements.currentPlayer) {
                // 确保current_player是字符串类型
                const playerStr = typeof gameState.current_player === 'object' ? 
                                 (gameState.current_player.name || '德军') : 
                                 (gameState.current_player || '德军');
                elements.currentPlayer.textContent = playerStr;
        // 设置当前玩家到全局变量
                window.currentPlayer = playerStr;
            }
        } catch (e) {
            console.error("更新基础游戏信息时出错:", e);
    }
    
    // 更新资源信息
        try {
    updatePlayerResources();
        } catch (e) {
            console.error("更新玩家资源时出错:", e);
        }
    
    // 更新操作按钮状态
        try {
    updateActionButtons();
        } catch (e) {
            console.error("更新操作按钮时出错:", e);
        }
        
        // 检查游戏是否已结束
        try {
            if (gameState.game_ended && gameState.winner) {
                showGameEndModal(gameState);
            }
        } catch (e) {
            console.error("检查游戏结束状态时出错:", e);
        }
    } catch (error) {
        console.error("更新游戏状态UI总体出错:", error);
    }
}

/**
 * 更新操作按钮状态
 */
function updateActionButtons() {
    // 获取所有操作按钮
    const buildTownBtn = document.getElementById('build-town');
    const buildRailwayBtn = document.getElementById('build-railway');
    const mobilizeBtn = document.getElementById('mobilize-troops');
    const declareWarBtn = document.getElementById('declare-war');
    const upgradeTownBtn = document.getElementById('upgrade-town');
    
    // 确保必要的全局状态存在
    if (!window.gameState) {
        console.error("更新按钮状态失败：游戏状态不存在");
        // 禁用所有按钮
        [buildTownBtn, buildRailwayBtn, mobilizeBtn, declareWarBtn, upgradeTownBtn].forEach(btn => {
            if (btn) btn.disabled = true;
        });
        return;
    }
    
    // 如果没有选择区域，禁用所有按钮
    if (!window.selectedRegion) {
        [buildTownBtn, buildRailwayBtn, mobilizeBtn, declareWarBtn, upgradeTownBtn].forEach(btn => {
            if (btn) btn.disabled = true;
        });
        return;
    }
    
    // 检查玩家是否可以操作该区域
    const canOperate = canPlayerOperateRegion(window.selectedRegion);
    
    // 建造城镇按钮
    if (buildTownBtn) {
        buildTownBtn.disabled = !canOperate;
    }
    
    // 建造铁路按钮
    if (buildRailwayBtn) {
        buildRailwayBtn.disabled = !canOperate || 
            !window.selectedRegion.hex_tiles || 
            window.selectedRegion.hex_tiles.length < 2;
    }
    
    // 动员军队按钮
    if (mobilizeBtn) {
        let hasTownsToMobilize = false;
        try {
            hasTownsToMobilize = window.selectedRegion.towns && 
                window.gameState.current_player && 
            window.selectedRegion.towns.some(t => t.owner === window.gameState.current_player);
        } catch (e) {
            console.error("检查可动员城镇时出错:", e);
        }
        mobilizeBtn.disabled = !canOperate || !hasTownsToMobilize;
    }
    
    // 宣战按钮
    if (declareWarBtn) {
        let isInTensionPhase = false;
        try {
            isInTensionPhase = window.gameState && 
            window.gameState.phase === "紧张期" && 
            !window.gameState.war_declared;
        } catch (e) {
            console.error("检查是否在紧张期时出错:", e);
        }
        declareWarBtn.disabled = !isInTensionPhase;
    }
    
    // 升级城镇按钮
    if (upgradeTownBtn) {
        let hasUpgradableTowns = false;
        try {
        // 检查是否有可升级的城镇
            hasUpgradableTowns = window.selectedRegion.towns && 
                window.gameState.current_player && 
            window.selectedRegion.towns.filter(town => 
                town.owner === window.gameState.current_player && 
                !town.is_under_construction
            ).length >= 2; // 需要至少两个城镇才能升级
        } catch (e) {
            console.error("检查可升级城镇时出错:", e);
        }
        
        upgradeTownBtn.disabled = !canOperate || !hasUpgradableTowns;
    }
}

/**
 * 添加游戏日志
 */
function addLogEntry(text) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = text;
    elements.gameLog.appendChild(entry);
    elements.gameLog.scrollTop = elements.gameLog.scrollHeight;
}

/**
 * 显示模态框
 */
function showModal(title, bodyContent, confirmCallback, isCloseable = true) {
    console.log("显示模态框:", title);
    console.log("模态框DOM元素:", elements.actionModal);
    
    if (!elements.actionModal) {
        console.error("找不到模态框元素!");
        return;
    }
    
    elements.modalTitle.textContent = title;
    elements.modalBody.innerHTML = bodyContent;
    elements.modalConfirm.onclick = confirmCallback;
    
    // 确保模态框可见
    elements.actionModal.style.display = 'block';
    console.log("模态框已显示");
    
    if (!isCloseable) {
        elements.closeModal.style.display = 'none';
    }
}

/**
 * 关闭模态框
 */
function closeModal() {
    elements.actionModal.style.display = 'none';
    
    // 确保关闭按钮可见，以便下次打开模态框时显示
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.style.display = 'block';
    }
    
    // 获取当前模态框标题
    const modalTitle = elements.modalTitle.textContent;
    
    // 铁路建设模式特殊处理
    if (modalTitle === '确认建设铁路') {
        console.log('退出铁路建设模式');
        // 清除所有标记
        const allMarks = document.querySelectorAll(".railway-start, .railway-end");
        allMarks.forEach(element => {
            element.classList.remove("railway-start", "railway-end");
        });
        
        // 退出铁路建设模式
        railwayBuildMode = false;
        firstSelectedHex = null;
        
        // 显示提示消息
        showMessage("已取消铁路建设");
    }
    
    // 重置特定模式状态 - 但保留升级城镇选择模式
    if (modalTitle === '建造城镇') {
        buildingTownMode = false;
    } else if (modalTitle === '动员军队') {
        troopMobilizeMode = false;
    } else if (modalTitle === '确认升级城镇') {
        // 只有在确认升级城镇时才退出升级模式
        exitTownUpgradeMode();
    }
    // 注意：这里不再处理"升级城镇"标题的模态框，以允许用户点击选择按钮后进入升级模式
    
    console.log(`关闭模态框: ${modalTitle}, 当前升级模式状态: ${upgradeTownMode}, 升级类型: ${currentUpgradeType}`);
}

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
 * 生成城镇默认名称
 * @param {string} regionName 区域名称
 * @returns {string} 生成的城镇名称
 */
function generateTownName(regionName) {
    // 获取该区域现有的城镇数量
    let townCount = 0;
    if (window.gameState && window.gameState.regions) {
        const region = window.gameState.regions.find(r => r.name === regionName);
        if (region && region.towns) {
            townCount = region.towns.length;
        }
    }
    
    // 生成编号
    const number = (townCount + 1).toString().padStart(2, '0');
    
    // 根据区域名称生成前缀
    let prefix = '';
    if (regionName.includes('法国')) {
        prefix = '法';
    } else if (regionName.includes('比利时')) {
        prefix = '比';
    } else if (regionName.includes('德国')) {
        prefix = '德';
    }
    
    return `${prefix}${number}号城`;
}

/**
 * 验证城镇名称
 * @param {string} name 城镇名称
 * @returns {object} 验证结果
 */
function validateTownName(name) {
    if (!name) {
        return { valid: false, message: '城镇名称不能为空' };
    }
    
    if (name.length > 8) {
        return { valid: false, message: '城镇名称不能超过8个字符' };
    }
    
    // 检查是否包含特殊字符
    const specialChars = /[`!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?~]/;
    if (specialChars.test(name)) {
        return { valid: false, message: '城镇名称不能包含特殊字符' };
    }
    
    // 检查是否与现有城镇重名
    if (window.gameState && window.gameState.regions) {
        for (const region of window.gameState.regions) {
            if (region.towns && region.towns.some(town => town.name === name)) {
                return { valid: false, message: '城镇名称已存在' };
            }
        }
    }
    
    return { valid: true };
}

/**
 * 显示建造城镇模态框
 */
function showBuildTownModal() {
    if (!window.selectedRegion) {
        console.error("没有选择区域，无法建造城镇");
        alert("请先选择一个区域");
        return;
    }
    
    // 进入城镇建设模式
    buildingTownMode = true;
    
    // 获取用户点击的坐标
    const clickedCoords = hexGrid.lastClickedCoords;
    if (!clickedCoords) {
        alert("请先点击要建造城镇的位置");
        buildingTownMode = false;
        return;
    }
    
    console.log("打开建造城镇模态框", window.selectedRegion.name);
    console.log("当前点击坐标:", clickedCoords);
    
    // 检查点击的坐标是否在当前区域内
    const isClickedInRegion = window.selectedRegion.hex_tiles && 
        window.selectedRegion.hex_tiles.some(hex => 
            hex.q === clickedCoords.q && 
            hex.r === clickedCoords.r && 
            hex.s === clickedCoords.s
        );
    
    if (!isClickedInRegion) {
        alert("请在当前选择的区域内点击要建造城镇的位置");
        buildingTownMode = false;
        return;
    }
    
    // 检查点击的位置是否已有城镇
    const hasTown = window.selectedRegion.towns && 
        window.selectedRegion.towns.some(town => 
            town.coords && 
            town.coords.q === clickedCoords.q && 
            town.coords.r === clickedCoords.r && 
            town.coords.s === clickedCoords.s
        );
    
    if (hasTown) {
        alert("该位置已有城镇");
        buildingTownMode = false;
        return;
    }
    
    // 生成默认城镇名称
    const defaultName = generateTownName(window.selectedRegion.name);
    
    const content = `
        <form id="build-town-form" class="modal-form">
            <div class="form-group">
                <label for="town-name">城镇名称:</label>
                <input type="text" id="town-name" value="${defaultName}" maxlength="8" required>
                <small class="form-text text-muted">最多8个字符，不能包含特殊字符</small>
                <div id="name-error" class="error-message" style="color: red;"></div>
            </div>
            <div class="form-group">
                <p>建造位置: (${clickedCoords.q}, ${clickedCoords.r})</p>
            </div>
            <div class="form-group">
                <p>消耗: <strong>50 GDP</strong></p>
            </div>
        </form>
    `;
    
    showModal('建造城镇', content, () => {
        const townName = document.getElementById('town-name').value;
        
        // 验证城镇名称
        const validation = validateTownName(townName);
        if (!validation.valid) {
            document.getElementById('name-error').textContent = validation.message;
            return;
        }
        
        buildTown(window.selectedRegion.id, clickedCoords, townName);
        buildingTownMode = false;
    });
    
    // 添加实时验证
    document.getElementById('town-name').addEventListener('input', (e) => {
        const validation = validateTownName(e.target.value);
        const errorElement = document.getElementById('name-error');
        if (!validation.valid) {
            errorElement.textContent = validation.message;
        } else {
            errorElement.textContent = '';
        }
    });
}

/**
 * 获取可用的六边形选项
 */
function getAvailableHexOptions() {
    if (!window.selectedRegion || !window.selectedRegion.hex_tiles) {
        console.log("没有选中区域或区域没有六边形格子");
        return '';
    }
    
    console.log("选择区域的六边形数量:", window.selectedRegion.hex_tiles.length);
    
    // 获取最后点击的坐标
    const lastClickedCoords = hexGrid.lastClickedCoords;
    console.log("最后点击的坐标:", lastClickedCoords);
    
    let options = '';
    let availableCount = 0;
    
    // 遍历当前选择区域的所有六边形格子
    for (const tile of window.selectedRegion.hex_tiles) {
        // 检查该格子是否已有城镇 (通过坐标匹配)
        const hasTown = window.selectedRegion.towns && window.selectedRegion.towns.some(town => 
            town.coords && town.coords.q === tile.q && town.coords.r === tile.r && town.coords.s === tile.s
        );
        
        // 如果格子上没有城镇，添加为选项
        if (!hasTown) {
            // 如果是当前点击的坐标，设为选中状态
            const isSelected = lastClickedCoords && 
                              lastClickedCoords.q === tile.q && 
                              lastClickedCoords.r === tile.r && 
                              lastClickedCoords.s === tile.s;
                              
            options += `<option value="${tile.q},${tile.r},${tile.s}" ${isSelected ? 'selected' : ''}>${tile.q},${tile.r},${tile.s}</option>`;
            availableCount++;
        }
    }
    
    console.log("可用六边形格子数量:", availableCount);
    
    // 如果没有可用的格子，显示一个提示
    if (availableCount === 0) {
        return '<option value="" disabled>该区域没有可用的空地</option>';
    }
    
    return options;
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
        // 清除所有可能存在的铁路起点标记
        const previousStarts = document.querySelectorAll(".railway-start");
        previousStarts.forEach(element => {
            element.classList.remove("railway-start");
        });
        
        // 进入铁路建设模式
        railwayBuildMode = true;
        firstSelectedHex = null;
        
        // 关闭模态框
        closeModal();
        
        // 显示引导提示
        showMessage("请选择铁路起点");
    });
}

/**
 * 显示动员军队模态框
 */
function showMobilizeTroopsModal() {
    if (!window.selectedRegion) return;
    
    // 进入军队动员模式
    troopMobilizeMode = true;
    
    // 获取当前玩家在该区域的城镇
    const ownTowns = window.selectedRegion.towns.filter(town => 
        town.owner === gameState.current_player && !town.is_under_construction
    );
    
    if (ownTowns.length === 0) {
        alert('该区域没有你的城镇或所有城镇都在建设中');
        troopMobilizeMode = false; // 如果没有城镇，退出模式
        return;
    }
    
    // 计算区域内所有可动员的城镇和总人口
    let totalPopulation = 0;
    let totalMobilized = 0;
    let townsList = '';
    
    ownTowns.forEach(town => {
        // 根据城镇等级确定动员率
        let mobilizationRate = 0;
        if (town.level === 'village') {
            mobilizationRate = 0.5; // 村落动员率50%
        } else if (town.level === 'small_city') {
            mobilizationRate = 0.4; // 小城市动员率40%
        } else if (town.level === 'large_city') {
            mobilizationRate = 0.3; // 大城市动员率30%
        }
        
        const maxMobilization = Math.floor(town.population * mobilizationRate);
        const availableMobilization = maxMobilization - (town.mobilized || 0);
        
        totalPopulation += availableMobilization;
        totalMobilized += (town.mobilized || 0);
        
        // 将英文等级转换为中文
        let displayLevel = town.level;
        const levelMap = {
            'village': '村落',
            'small_city': '小城市', 
            'large_city': '大城市'
        };
        if (levelMap[town.level]) {
            displayLevel = levelMap[town.level];
        }
        
        townsList += `
            <li>
                ${town.name} (${displayLevel}) - 
                可动员: <strong>${availableMobilization}万</strong>
                ${town.mobilized ? `(已动员: ${town.mobilized}万)` : ''}
            </li>
        `;
    });
    
    const content = `
        <div class="modal-content-large">
            <h3>区域动员 - ${window.selectedRegion.name}</h3>
            
            <div class="mobilization-info">
                <p>区域内总可动员人口: <strong>${totalPopulation}万</strong></p>
                <p>动员进程: 生成 → 装载 → 运输</p>
                <p class="warning">注意：动员后该区域将无法再进行建设</p>
            </div>
            
            <div class="town-list">
                <h4>可动员城镇列表：</h4>
                <ul>${townsList}</ul>
            </div>
            
            <div class="form-group">
                <label for="mobilize-confirmation">
                    <input type="checkbox" id="mobilize-confirmation" required>
                    确认动员整个区域
                </label>
            </div>
        </div>
    `;
    
    showModal('动员军队', content, () => {
        const isConfirmed = document.getElementById('mobilize-confirmation').checked;
        
        if (!isConfirmed) {
            alert('请确认动员');
            return;
        }
        
        // 执行区域动员
        mobilizeRegion(window.selectedRegion.id);
        troopMobilizeMode = false; // 动员完成后退出模式
    });
}

/**
 * 对整个区域进行动员
 */
function mobilizeRegion(regionId) {
    fetch('/api/mobilize-troops', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            region_id: regionId,
            player: gameState.current_player,
            is_region_mobilization: true // 指示这是区域动员而不是单个城镇
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            gameState = data.game_state;
            console.log('区域动员成功:', gameState);
            
            // 更新UI
            updateGameStateUI();
            
            // 更新地图显示
            updateMap(gameState);
            
            // 更新区域信息
            updateRegionInfo();
            
            // 添加日志
            addLogEntry(`${window.selectedRegion.name} 区域动员成功，动员 ${data.amount || '若干'} 万兵力`);
            closeModal();
            
            // 显示动员成功的消息
            showMessage(`${window.selectedRegion.name} 区域动员成功！`);
        } else {
            addLogEntry('动员军队失败');
            alert(data.message || '动员军队失败');
        }
        troopMobilizeMode = false; // 无论成功失败，都退出模式
    })
    .catch(error => {
        console.error('区域动员失败:', error);
        addLogEntry('动员军队失败');
        troopMobilizeMode = false; // 发生错误，退出模式
    });
}

/**
 * 显示宣战模态框
 */
function showDeclareWarModal() {
    // 确保游戏状态已初始化
    if (!window.gameState) {
        showMessage("游戏状态未初始化，请刷新页面");
        console.error("游戏状态未初始化");
        return;
    }
    
    // 确保当前处于紧张期且未宣战
    if (window.gameState.phase !== "紧张期") {
        showMessage("只有在紧张期才能宣战");
        return;
    }
    
    if (window.gameState.war_declared) {
        showMessage("已经宣战，无法再次宣战");
        return;
    }
    
    const content = `
        <div class="warning">
            <p>确定要宣战吗？</p>
            <p>宣战后游戏将在3回合后进行战斗结算。</p>
            <p>战斗将在冲突区域进行，只计算冲突区域内的兵力。</p>
        </div>
    `;
    
    showModal('宣战', content, () => {
        declareWar();
    });
}

/**
 * 宣战
 */
function declareWar() {
    console.log("尝试宣战...");
    
    // 检查当前回合是否在保护期内
    const currentRound = gameState.round || 1;
    if (currentRound <= 30) {
        showTempMessage("保护期内不能宣战，保护期将持续到第30回合结束");
        return Promise.resolve(false);
    }
    
    // 获取当前玩家
    const currentPlayer = gameState.current_player;
    if (!currentPlayer) {
        console.error("无法确定当前玩家");
        return Promise.resolve(false);
    }
    
    // 确定冲突区域
    let conflictRegionId = null;
    if (currentPlayer === "德军") {
        conflictRegionId = "GE-3"; // 德军冲突区域
    } else {
        conflictRegionId = "FR-3"; // 协约国冲突区域
    }
    
    // 获取冲突区域对象
    const conflictRegion = gameState.regions.find(r => r.id === conflictRegionId);
    if (!conflictRegion) {
        console.error(`找不到冲突区域: ${conflictRegionId}`);
        return Promise.resolve(false);
    }
    
    // 检查区域是否已有冲突
    if (conflictRegion.conflict) {
        showTempMessage("该区域已存在冲突");
        return Promise.resolve(false);
    }
    
    // 检查当前玩家在该区域是否有足够的部队
    let playerTotalTroops = 0;
    if (conflictRegion.towns) {
        for (const town of conflictRegion.towns) {
            if (town.owner === currentPlayer && town.troops) {
                playerTotalTroops += town.troops;
            }
        }
    }
    
    // 检查最低要求的部队数量（例如至少5个）
    const minimumTroopsRequired = 5;
    if (playerTotalTroops < minimumTroopsRequired) {
        showTempMessage(`宣战需要至少${minimumTroopsRequired}个部队在冲突区域`);
        return Promise.resolve(false);
    }
    
    // 准备请求数据
    const requestData = {
        player: currentPlayer,
        region_id: conflictRegionId
    };
    
    // 发送宣战请求
    return fetch('/api/declare-war', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const errorData = JSON.parse(text);
                    throw new Error(errorData.error || `HTTP错误: ${response.status}`);
                } catch (e) {
                    throw new Error(`宣战失败: ${text}`);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('宣战成功:', data);
            
            // 更新游戏状态
            window.gameState = data.game_state;
            gameState = data.game_state;
            
            // 更新UI
            updateGameStateUI();
            updateMap(gameState);
            
            // 添加日志
            addLogEntry(`${currentPlayer}在${conflictRegion.name}宣战`);
            
            // 显示成功消息
            showTempMessage("宣战成功！");
            
            return true;
        } else {
            console.error('宣战失败:', data.error);
            showTempMessage(`宣战失败: ${data.error || '未知错误'}`);
            return false;
        }
    })
    .catch(error => {
        console.error('宣战过程中发生错误:', error);
        showTempMessage(`宣战错误: ${error.message}`);
        return false;
    });
}

/**
 * 获取游戏状态
 * @returns {Promise} Promise对象
 */
function fetchGameState() {
    return fetch('/api/game-state')
        .then(response => {
            if (!response.ok) {
                throw new Error(`获取游戏状态失败: ${response.status} ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            if (!data) {
                // 如果返回空数据，尝试使用当前状态
                if (window.gameState) {
                    console.warn("服务器返回空数据，使用缓存的游戏状态");
                    return window.gameState;
                }
                throw new Error("获取游戏状态返回空数据");
            }
            
            // 检查数据是否有基本必要的字段
            if (!data.phase || !data.current_player) {
                console.warn("服务器返回的游戏状态缺少必要字段");
                // 如果有现有状态，尝试合并
                if (window.gameState) {
                    console.warn("尝试与现有状态合并");
                    data = {
                        ...window.gameState,
                        ...data
                    };
                }
            }
            
            console.log("获取游戏状态成功:", data);
            
            try {
            // 保存游戏状态到全局变量
            window.gameState = data;
                // 确保两个变量同步
                gameState = window.gameState;
            
            // 更新界面
            updateGameStateUI(data);
            
            // 使用新实现的updateMap更新地图
            updateMap(data);
            } catch (e) {
                console.error("处理游戏状态时出错:", e);
            }
            
            if (data.round !== undefined) {
                checkAndShowRandomEvent(data.round);
            }
            
            return data;
        })
        .catch(error => {
            console.error("获取游戏状态失败:", error);
            addLogEntry("获取游戏状态失败，请刷新页面重试。");
            
            // 在出错情况下，尝试使用可能存在的window.gameState
            if (window.gameState) {
                console.log("使用缓存的游戏状态");
                try {
                    updateGameStateUI(window.gameState);
                    updateMap(window.gameState);
                } catch (e) {
                    console.error("使用缓存状态更新UI时出错:", e);
                }
            } else {
                // 如果没有缓存状态，尝试创建一个基本状态
                console.log("创建基本游戏状态");
                const basicState = {
                    round: 1,
                    phase: "保护期",
                    current_player: getCurrentPlayerFromURL() || "德军",
                    regions: [],
                    players: {}
                };
                window.gameState = basicState;
                gameState = basicState;
            }
            
            throw error; // 重新抛出错误以便调用者处理
        });
}

/**
 * 从URL获取当前玩家
 */
function getCurrentPlayerFromURL() {
    // 从URL中提取玩家参数
    const urlParams = new URLSearchParams(window.location.search);
    const player = urlParams.get('player');
    
    // 将玩家参数映射到标准标识符
    if (player) {
        if (player === 'GE' || player === 'DE' || player.includes('德')) {
            return "德军";
        } else if (player === 'FR' || player.includes('法') || player.includes('协')) {
            return "协约国";
        }
    }
    
    // 如果已经设置了window.standardPlayerName，使用它
    if (window.standardPlayerName) {
        return window.standardPlayerName;
    }
    
    // 默认为"德军"
    return "德军";
}

/**
 * 进入下一回合
 */
function nextRound() {
    // 如果启用了AI对战，使用新的回合控制流程
    if (aiEnabled) {
        readyForNextRound();
        return;
    }
    
    // 否则使用原来的回合切换逻辑（适用于没有AI对战时的情况）
    // 记录当前玩家，确保不会切换阵营
    const currentFaction = gameState.current_player;
    console.log("当前阵营:", currentFaction);
    
    // 简化的请求，只包含最基本的信息
    const requestData = {
        player: currentFaction
    };
    
    console.log("发送到服务器的简化数据:", requestData);
    
    fetch('/api/next-round', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const errorData = JSON.parse(text);
                    throw new Error(errorData.error || `HTTP错误: ${response.status}`);
                } catch (e) {
                    throw new Error(`进入下一回合失败: ${text}`);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            // 检查返回的阵营是否与当前阵营一致
            if (data.game_state.current_player !== currentFaction) {
                console.error("错误: 阵营发生了改变", currentFaction, "->", data.game_state.current_player);
                // 强制修正回来
                data.game_state.current_player = currentFaction;
            }
            
            console.log('进入下一回合成功:', data.game_state);
            window.gameState = data.game_state;
            gameState = data.game_state;
            
            // 备份当前的合并城镇数据
            const mergedTownBackup = JSON.parse(JSON.stringify(window.mergedTownLocations || {}));
            
            // 更新UI和地图
            updateGameStateUI();
            updateMap(gameState);
            
            // 恢复合并城镇的位置信息
            restoreMergedTownLocations(mergedTownBackup);
            
            addLogEntry(`进入新回合: ${gameState.round}, 当前玩家: ${gameState.current_player}`);
        } else {
            addLogEntry('进入下一回合失败');
        }
    })
    .catch(error => {
        console.error('Error advancing round:', error);
        addLogEntry(error.message);
    });
}

// 新函数：恢复合并城镇的位置信息
function restoreMergedTownLocations(mergedTownBackup) {
    if (!window.gameState || !window.gameState.regions) return;
    
    console.log("恢复合并城镇的位置信息", mergedTownBackup);
    
    // 如果window.mergedTownLocations不存在，则创建
    if (!window.mergedTownLocations) {
        window.mergedTownLocations = {};
    }
    
    // 遍历所有备份的合并城镇
    for (const [townName, townInfo] of Object.entries(mergedTownBackup)) {
        // 查找该城镇是否仍然存在
        let foundTown = null;
        let foundRegion = null;
        
        for (const region of window.gameState.regions) {
            if (region.towns) {
                foundTown = region.towns.find(t => t.name === townName);
                if (foundTown) {
                    foundRegion = region;
                    break;
                }
            }
        }
        
        // 如果城镇依然存在，恢复其位置信息
        if (foundTown && foundRegion) {
            window.mergedTownLocations[townName] = {
                regionId: foundRegion.id,
                level: foundTown.level,
                owner: foundTown.owner,
                locations: townInfo.locations,
                is_under_construction: foundTown.is_under_construction || false,
                gdp: foundTown.level === 'large_city' ? 500 : 
                     foundTown.level === 'small_city' ? 200 : 75
            };
            
            console.log(`恢复合并城镇: ${townName}`, window.mergedTownLocations[townName]);
            
            // 确保hex_tiles中的town引用是正确的
            if (foundRegion.hex_tiles) {
                townInfo.locations.forEach(loc => {
                    const hexTile = foundRegion.hex_tiles.find(h => 
                        h.q === loc.q && h.r === loc.r
                    );
                    if (hexTile) {
                        hexTile.town = {
                            name: townName,
                            level: foundTown.level,
                            owner: foundTown.owner,
                            is_under_construction: foundTown.is_under_construction
                        };
                    }
                });
            }
        }
    }
    
    // 刷新地图以显示恢复的城镇
    updateMap(window.gameState);
}

/**
 * 重置游戏
 */
function resetGame() {
    console.log("重置游戏...");
    
    // 清除所有区域高亮和选择状态
    clearAllHighlights();
    
    // 重置选择状态
    selectedRegion = null;
    selectedTown = null;
    selectedHex = null;
    
    // 重置模式状态
    isMobilizing = false;
    isAttacking = false;
    mobilizationSource = null;
    mobilizationTarget = null;
    townUpgradeSelected = null;
    townUpgradeType = null;
    attackSource = null;
    attackTarget = null;
    
    // 更新界面
    updateRegionInfo();
    updateActionButtons();
    
    // 清除铁路和其他地图元素
    clearRailways();
    
    // 重新获取游戏状态
    fetchGameState();
    
    // 重置AI相关状态
    window.playerReady = false;
    window.aiReady = false;
    window.aiThinking = false;
    
    // 重置游戏阶段
    gamePhase = "construction";
    
    // 更新界面显示
    updatePhaseDisplay();
    updatePlayerStatus();
    
    console.log("游戏已重置");
}

/**
 * 清除所有铁路
 */
function clearRailways() {
    console.log("清除所有铁路...");
    
    // 确保hexGrid存在
    if (!window.hexGrid) {
        console.error("hexGrid未初始化，无法清除铁路");
        return;
    }
    
    // 清除铁路数组
    window.railways = [];
    
    // 调用hexGrid的更新方法，传递false表示不保留铁路
    // 注意：如果当前没有游戏状态，仅清除铁路图形元素
    if (window.gameState) {
        window.hexGrid.updateMap(window.gameState, false);
        } else {
        // 直接清除铁路图形元素
        if (window.hexGrid.railwaysLayer) {
            window.hexGrid.railwaysLayer.innerHTML = '';
        }
        window.hexGrid.railways = [];
    }
    
    console.log("铁路清除完成");
}

/**
 * 建造城镇
 * @param {string} regionId 区域ID
 * @param {Object} coords 坐标对象，包含q, r, s属性
 * @param {string} townName 城镇名称
 * @param {boolean} isAI 是否为AI操作，默认为false
 * @param {string} playerFaction AI操作时的玩家阵营，可选
 * @returns {Promise} 返回Promise对象
 */
function buildTown(regionId, coords, townName, isAI = false, playerFaction = null) {
    console.log("正在建造城镇:", regionId, coords, townName, isAI ? "(AI操作)" : "");
    
    return new Promise((resolve, reject) => {
    // 检查参数是否完整
    if (!regionId || !coords || !townName) {
        console.error("建造城镇参数不完整:", regionId, coords, townName);
            if (!isAI) alert("建造城镇失败: 参数不完整");
        buildingTownMode = false; // 参数不完整，退出模式
            reject(new Error("建造城镇参数不完整"));
        return;
    }
    
    // 检查坐标是否有效
    if (coords.q === undefined || coords.r === undefined || coords.s === undefined) {
        console.error("建造城镇坐标无效:", coords);
            if (!isAI) alert("建造城镇失败: 坐标无效");
            reject(new Error("建造城镇坐标无效"));
        return;
    }
    
    // 确保坐标是整数
    const q = parseInt(coords.q);
    const r = parseInt(coords.r);
    const s = parseInt(coords.s);
    
    // 检查s坐标是否符合要求 (s = -(q+r))
    if (s !== -(q + r)) {
        console.warn(`警告: s坐标不符合s=-(q+r)规则，当前s=${s}，计算值=${-(q+r)}。正在自动修正。`);
    }
    
    // 确保当前玩家存在
    if (!window.gameState || !window.gameState.current_player) {
        console.error("无法获取当前玩家信息");
            if (!isAI) alert("建造城镇失败: 无法获取当前玩家信息");
        buildingTownMode = false; // 无玩家信息，退出模式
            reject(new Error("无法获取当前玩家信息"));
        return;
    }
    
    // 保存合并城镇数据，以便在建造完成后恢复
    const mergedTownBackup = JSON.parse(JSON.stringify(window.mergedTownLocations || {}));
    console.log("建造城镇前备份的合并城镇数据:", mergedTownBackup);
        
        // 确保使用正确的玩家信息
        let currentPlayer = window.gameState.current_player;
        // 如果是AI操作且提供了playerFaction参数
        if (isAI && playerFaction) {
            currentPlayer = playerFaction;
            console.log(`使用AI指定的阵营 ${playerFaction} 而非当前玩家 ${window.gameState.current_player}`);
        }
    
    console.log("发送建造城镇请求:", {
        region_id: regionId,
        q: q,
        r: r,
        s: s,
        town_name: townName,
            player: currentPlayer
    });
    
    fetch('/api/build-town', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            region_id: regionId,
            q: q,
            r: r,
            s: s,
            town_name: townName,
                player: currentPlayer
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    // 尝试解析为JSON
                    const errorData = JSON.parse(text);
                    throw new Error(errorData.error || `HTTP错误: ${response.status}`);
                } catch (e) {
                    // 如果无法解析为JSON，则返回原始文本
                    throw new Error(`HTTP错误! 状态: ${response.status}, 消息: ${text}`);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('城镇建造成功:', data.game_state);
            
            // 保存当前选中的区域ID，以便后续找回该区域
            const currentRegionId = window.selectedRegion ? window.selectedRegion.id : null;
            
            // 更新游戏状态
            window.gameState = data.game_state;
            gameState = data.game_state;
            
            // 恢复备份的合并城镇数据
            console.log("恢复备份的合并城镇数据...");
            for (const [townName, townInfo] of Object.entries(mergedTownBackup)) {
                // 检查该合并城镇是否仍然存在
                let townExists = false;
                for (const region of gameState.regions) {
                    if (region.towns && region.towns.some(t => t.name === townName)) {
                        townExists = true;
                        break;
                    }
                }
                
                if (townExists) {
                    console.log(`恢复合并城镇 ${townName} 的所有位置信息`);
                    window.mergedTownLocations[townName] = townInfo;
                    
                    // 确保所有合并城镇的格子都正确标记
                    for (const region of gameState.regions) {
                        if (region.id === townInfo.regionId && region.hex_tiles) {
                            for (const loc of townInfo.locations) {
                                const hex = region.hex_tiles.find(h => 
                                    h.q === loc.q && h.r === loc.r && (h.s === loc.s || h.s === undefined)
                                );
                                if (hex) {
                                    hex.town = townName;
                                    console.log(`重新标记格子 (${loc.q},${loc.r}) 属于合并城镇 ${townName}`);
                                }
                            }
                        }
                    }
                }
            }
            
            // 更新UI
            updateGameStateUI();
            
            // 更新地图
            updateMap(gameState);
            
            // 重新找回当前选中的区域
            if (currentRegionId) {
                window.selectedRegion = window.gameState.regions.find(r => r.id === currentRegionId);
                selectedRegion = window.selectedRegion;
                console.log("重新选中区域:", window.selectedRegion);
            }
            
            // 更新区域信息
            updateRegionInfo();
            
            // 添加日志
            addLogEntry(`建造城镇 ${townName} 成功`);
                if (!isAI) closeModal();
                resolve({ success: true });
        } else {
            const errorMsg = data.error || '未知错误';
            console.error('建造城镇失败:', errorMsg);
            addLogEntry(`建造城镇失败: ${errorMsg}`);
                if (!isAI) alert(`建造城镇失败: ${errorMsg}`);
        buildingTownMode = false; // 无论成功失败，都退出模式
                reject({ success: false, error: errorMsg });
            }
    })
    .catch(error => {
        console.error('Error building town:', error);
        addLogEntry('建造城镇失败: ' + error.message);
            if (!isAI) alert('建造城镇错误: ' + error.message);
        buildingTownMode = false; // 发生错误，退出模式
            reject(error);
        });
    });
}

/**
 * 检查两个六边形是否相邻
 * @param {number} startQ 起点Q坐标
 * @param {number} startR 起点R坐标
 * @param {number} endQ 终点Q坐标
 * @param {number} endR 终点R坐标
 * @returns {boolean} 是否相邻
 */
function areHexesAdjacent(startQ, startR, endQ, endR) {
    // 获取起点的相邻坐标列表
    let neighbors;
    if (startQ % 2 === 0) {
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
    return neighbors.some(n => n.q === endQ && n.r === endR);
}

/**
 * 建造铁路
 * @param {string} regionId 区域ID
 * @param {Object} startCoords 起点坐标 {q, r}
 * @param {Object} endCoords 终点坐标 {q, r}
 * @param {string} playerFaction 可选参数，指定玩家阵营，AI调用时使用
 * @returns {Promise<boolean>} 返回Promise，解析为建设成功与否
 */
function buildRailway(regionId, startCoords, endCoords, playerFaction = null) {
    console.log("正在建造铁路:", regionId, startCoords, endCoords, "玩家阵营:", playerFaction);
    
    // 如果起点和终点不在同一区域，记录日志
    if (startCoords.region && endCoords.region && startCoords.region.id !== endCoords.region.id) {
        console.log(`跨区域建设铁路，从 ${startCoords.region.id} 到 ${endCoords.region.id}`);
        // 使用起点所在区域作为API请求的区域ID
        regionId = startCoords.region.id;
    }
    
    // 备份当前的城镇数据
    const allTowns = [];
    if (window.gameState && window.gameState.regions) {
        window.gameState.regions.forEach(region => {
            if (region.towns && region.towns.length > 0) {
                region.towns.forEach(town => {
                    // 深度复制城镇数据
                    const townCopy = JSON.parse(JSON.stringify(town));
                    townCopy.region_id = region.id;
                    allTowns.push(townCopy);
                });
            }
        });
    }
    console.log("建造铁路前的城镇数据:", allTowns);
    
    // 保存合并城镇数据，以便在建造完成后恢复
    const mergedTownBackup = JSON.parse(JSON.stringify(window.mergedTownLocations || {}));
    console.log("建造铁路前备份的合并城镇数据:", mergedTownBackup);
    
    // 确定使用哪个玩家进行操作
    const operatingPlayer = playerFaction || gameState.current_player;
    console.log(`铁路建设操作玩家: ${operatingPlayer}`);
    
    return fetch('/api/build-railway', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            region_id: regionId,
            start_q: startCoords.q,
            start_r: startCoords.r,
            start_s: startCoords.s || -(startCoords.q + startCoords.r),
            end_q: endCoords.q,
            end_r: endCoords.r,
            end_s: endCoords.s || -(endCoords.q + endCoords.r),
            player: operatingPlayer
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const errorData = JSON.parse(text);
                    throw new Error(errorData.message || errorData.error || `HTTP错误: ${response.status}`);
                } catch (e) {
                    throw new Error(`建造铁路失败: ${text}`);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('铁路建造成功:', data.game_state);
            
            // 保存当前选中的区域ID，以便后续找回该区域
            const currentRegionId = window.selectedRegion ? window.selectedRegion.id : null;
            
            // 更新游戏状态
            window.gameState = data.game_state;
            gameState = data.game_state;
            
            // 恢复合并城镇数据
            console.log("恢复合并城镇数据...");
            for (const [townName, townInfo] of Object.entries(mergedTownBackup)) {
                // 检查该合并城镇是否仍然存在
                let townExists = false;
                let foundRegion = null;
                
                for (const region of gameState.regions) {
                    if (region.towns && region.towns.some(t => t.name === townName)) {
                        townExists = true;
                        foundRegion = region;
                        break;
                    }
                }
                
                if (townExists && foundRegion) {
                    console.log(`恢复合并城镇 ${townName} 的所有位置信息`);
                    window.mergedTownLocations[townName] = townInfo;
                    
                    // 确保所有合并城镇的格子都正确标记
                    if (foundRegion.hex_tiles) {
                        townInfo.locations.forEach(loc => {
                            const hex = foundRegion.hex_tiles.find(h => 
                                h.q === loc.q && h.r === loc.r && 
                                (h.s === loc.s || h.s === -(loc.q + loc.r))
                            );
                            
                            if (hex) {
                                hex.town = townName;
                                console.log(`重新标记格子 (${loc.q},${loc.r}) 属于合并城镇 ${townName}`);
                            }
                        });
                    }
                }
            }
            
            // 更新UI
            updateGameStateUI();
            
            // 更新地图前先检查铁路数据
            console.log("更新地图前的铁路数据:", gameState.railways);
            
            // 在调用updateMap之前直接添加我们刚建造的铁路
            console.log("直接添加新建的铁路:");
            hexGrid.addRailway(
                startCoords.q, startCoords.r, startCoords.s || -(startCoords.q + startCoords.r),
                endCoords.q, endCoords.r, endCoords.s || -(endCoords.q + endCoords.r),
                "一级铁路"
            );
            
            // 更新地图
            updateMap(gameState);
            
            // 检查地图更新后的铁路
            console.log("地图更新后hexGrid的铁路:", hexGrid.railways);
            
            // 重新找回当前选中的区域
            if (currentRegionId) {
                window.selectedRegion = window.gameState.regions.find(r => r.id === currentRegionId);
                selectedRegion = window.selectedRegion;
                console.log("重新选中区域:", window.selectedRegion);
            }
            
            // 更新区域信息
            updateRegionInfo();
            
            // 添加日志
            addLogEntry(`${operatingPlayer}建造铁路成功`);
            closeModal();
            return true;
        } 
        
        // 处理失败情况
        console.error('建造铁路失败:', data);
        
        // 尝试从响应中提取更详细的错误信息
        let errorMessage = '建造铁路失败';
        if (data.message) {
            errorMessage = data.message;
        } else if (data.error) {
            errorMessage = data.error;
        }
        
        // 检查常见错误原因
        if (errorMessage.includes('GDP不足')) {
            errorMessage = '建造铁路失败：GDP资源不足';
        } else if (errorMessage.includes('格子不相邻')) {
            errorMessage = '建造铁路失败：选择的格子不相邻';
        } else if (errorMessage.includes('找不到格子')) {
            errorMessage = '建造铁路失败：找不到指定的格子';
        }
        
        addLogEntry(errorMessage);
        showMessage(errorMessage);
        return false;
    })
    .catch(error => {
        console.error('Error building railway:', error);
        addLogEntry(`建造铁路失败：${error.message}`);
        showMessage(`建造铁路失败：${error.message}`);
        return false;
    });
}

/**
 * 动员军队
 */
function mobilizeTroops(regionId, townName, amount) {
    fetch('/api/mobilize-troops', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            region_id: regionId,
            town_name: townName,
            amount: amount,
            player: gameState.current_player
        })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            gameState = data.game_state;
            console.log('Troops mobilized:', gameState);
            
            // 更新UI
            updateGameStateUI();
            
            // 更新区域信息
            updateRegionInfo(selectedRegion);
            
            // 添加日志
            addLogEntry(`动员军队 ${data.amount} 人成功`);
            closeModal();
        } else {
            addLogEntry('动员军队失败');
            alert('动员军队失败，请检查人口是否足够');
        }
        troopMobilizeMode = false; // 无论成功失败，都退出模式
    })
    .catch(error => {
        console.error('Error mobilizing troops:', error);
        addLogEntry('动员军队失败');
        troopMobilizeMode = false; // 发生错误，退出模式
    });
}

/**
 * 处理铁路建设模式下的点击
 */
function handleRailwayBuildClick(q, r, s) {
    console.log("处理铁路建造点击:", q, r, s);
    
    if (!railwayBuildMode) {
        console.log("未处于铁路建造模式");
        return;
    }
    
    // 检查是否是重复点击
    const now = Date.now();
    
    // 防止连续快速点击两次同一个格子
    if (!window.lastRailwayClick) {
        window.lastRailwayClick = {
            q: q,
            r: r,
            s: s,
            time: now
        };
    } else {
        // 检查是否是同一个格子的重复点击
    if (window.lastRailwayClick.q === q && 
        window.lastRailwayClick.r === r && 
        window.lastRailwayClick.s === s &&
        now - window.lastRailwayClick.time < 500) { // 500ms内的重复点击将被忽略
        return;
    }
    
    window.lastRailwayClick = {
            q: q,
            r: r,
            s: s,
        time: now
    };
    }
    
    // 使用更可靠的选择器查找格子元素
    const hexElement = findHexElement(q, r, s);
    
    if (!hexElement) {
        console.log("无法找到格子元素，跳过铁路建造");
        showMessage("无法找到格子元素，请重试或选择其他格子");
        return;
    }
    
    // 确定点击格子所在的区域
    let clickedRegion = null;
    for (const region of gameState.regions) {
        for (const hex of region.hex_tiles) {
            if (hex.q === q && hex.r === r && (hex.s === s || hex.s === -(q + r))) {
                clickedRegion = region;
                    break;
                }
            }
        if (clickedRegion) break;
    }
    
    if (!clickedRegion) {
        console.log("找不到点击格子所在的区域");
        showMessage("找不到该格子所在的区域");
        return;
    }
    
    // 获取铁路建造的起点和终点
    if (!window.railwayStart) {
        // 清除之前的所有标记
            const previousMarks = document.querySelectorAll(".railway-start, .railway-end");
            previousMarks.forEach(element => {
                element.classList.remove("railway-start", "railway-end");
            });
            
        // 标记起点
            hexElement.classList.add("railway-start");
        
        // 记录起点数据
        window.railwayStart = {
            q: q,
            r: r,
            s: s,
            region: clickedRegion
        };
        console.log("设置铁路起点:", window.railwayStart);
    } else {
        // 如果点击的是起点，则取消选择
        if (window.railwayStart.q === q && window.railwayStart.r === r && window.railwayStart.s === s) {
                // 清除所有标记
                const previousMarks = document.querySelectorAll(".railway-start, .railway-end");
                previousMarks.forEach(element => {
                    element.classList.remove("railway-start", "railway-end");
                });
                
            // 重置起点
            window.railwayStart = null;
            console.log("取消铁路起点选择");
                return;
            }
            
        // 如果已经选择了终点，则清除该终点
            const previousEndMarks = document.querySelectorAll(".railway-end");
            previousEndMarks.forEach(element => {
                element.classList.remove("railway-end");
            });
            
        // 标记新的终点
            hexElement.classList.add("railway-end");
            
        // 检查起点和终点是否相邻
        const startQ = window.railwayStart.q;
        const startR = window.railwayStart.r;
        
        if (!areHexesAdjacent(startQ, startR, q, r)) {
            console.log("选中的格子不相邻，无法建造铁路");
            showMessage("选中的格子不相邻，无法建造铁路");
            // 移除终点标记
                hexElement.classList.remove("railway-end");
                return;
            }
            
        // 记录终点
        window.railwayEnd = {
            q: q,
            r: r,
            s: s,
            region: clickedRegion
        };
        console.log("设置铁路终点:", window.railwayEnd);
        
        // 清除标记
                const allMarks = document.querySelectorAll(".railway-start, .railway-end");
                allMarks.forEach(element => {
                    element.classList.remove("railway-start", "railway-end");
                });
                
        // 退出铁路建造模式
                railwayBuildMode = false;
                
        // 执行铁路建造操作
                buildRailway(
            window.railwayStart.region.id,
            window.railwayStart,
            window.railwayEnd,
            gameState.current_player // 添加当前玩家作为playerFaction参数
        );
        
        // 重置起点和终点
        window.railwayStart = null;
        window.railwayEnd = null;
    }
}

/**
 * 查找六边形元素的辅助函数
 * @param {number} q - q坐标
 * @param {number} r - r坐标
 * @param {number} s - s坐标
 * @returns {Element|null} - 找到的六边形元素或null
 */
function findHexElement(q, r, s) {
    console.log(`查找格子元素，坐标:(${q}, ${r}, ${s})`);
    
    // 1. 使用hexGrid.hexagons直接查找
    if (hexGrid && hexGrid.hexagons) {
        const key = `${q},${r},${s}`;
        console.log(`尝试使用键 "${key}" 查找hexagons对象`);
        const hex = hexGrid.hexagons[key];
        if (hex && hex.group) {
            console.log(`在hexagons对象中找到了格子，返回group元素`);
            return hex.group;
        } else {
            console.log(`在hexagons对象中没有找到键 "${key}"`);
        }
    } else {
        console.log(`hexGrid或hexGrid.hexagons不存在`);
    }
    
    // 2. 使用data属性选择器
    const selector = `polygon[data-q="${q}"][data-r="${r}"][data-s="${s}"]`;
    console.log(`尝试使用选择器查找: "${selector}"`);
    const polygon = document.querySelector(selector);
    if (polygon && polygon.parentElement) {
        console.log(`通过选择器找到了格子元素，返回父元素`);
        return polygon.parentElement;
    } else {
        console.log(`未能通过选择器找到格子元素`);
    }
    
    // 3. 遍历hexagons对象查找匹配的坐标
    if (hexGrid && hexGrid.hexagons) {
        console.log(`尝试遍历hexagons对象查找匹配的坐标`);
        for (const [key, hex] of Object.entries(hexGrid.hexagons)) {
            if (hex.q === parseInt(q) && 
                hex.r === parseInt(r) && 
                (hex.s === parseInt(s) || hex.s === -(parseInt(q) + parseInt(r)))) {
                console.log(`找到了匹配的格子坐标: ${key}, 返回group元素`);
                return hex.group;
            }
        }
        console.log(`遍历完毕，未找到匹配的格子坐标`);
    }
    
    // 4. 尝试直接根据ID查找（虽然可能有格式问题）
    const hexId = `hex-${q}-${r}-${s}`;
    console.log(`尝试使用ID查找: "${hexId}"`);
    const element = document.getElementById(hexId);
    if (element) {
        console.log(`通过ID找到了格子元素`);
        return element;
    } else {
        console.log(`未能通过ID找到格子元素`);
    }
    
    // 5. 如果所有方法都失败，尝试使用q和r查找，忽略s
    if (hexGrid && hexGrid.hexagons) {
        console.log(`尝试只使用q和r查找，忽略s值`);
        for (const [key, hex] of Object.entries(hexGrid.hexagons)) {
            if (hex.q === parseInt(q) && hex.r === parseInt(r)) {
                console.log(`找到了匹配q和r的格子: ${key}, 返回group元素`);
                return hex.group;
            }
        }
        console.log(`未找到仅匹配q和r的格子`);
    }
    
    console.log(`所有查找方法都失败，无法找到格子元素(${q}, ${r}, ${s})`);
    
    // 添加完整的hexGrid.hexagons对象内容日志，帮助调试
    if (hexGrid && hexGrid.hexagons) {
        console.log(`hexagons中的前5个键:`);
        const keys = Object.keys(hexGrid.hexagons);
        const sampleKeys = keys.slice(0, 5);
        console.log(sampleKeys);
    }
    
    return null;
}

/**
 * 显示升级城镇模态框
 */
function showUpgradeTownModal() {
    // 检查是否选择了区域
    if (!selectedRegion) {
        showMessage('请先选择一个区域');
        return;
    }
    
    console.log('显示升级城镇模态框，当前模式状态:', {
        upgradeTownMode: upgradeTownMode,
        currentUpgradeType: currentUpgradeType
    });
    
    // 重置升级模式状态
    upgradeTownMode = false;
    window.upgradeTownMode = false;
    currentUpgradeType = null;
    window.currentUpgradeType = null;
    selectedTowns = [];
    window.selectedTowns = [];
    
    // 清除所有高亮效果
    clearAllTownHighlights();
    
    // 获取当前区域中的城镇
    const playerTowns = selectedRegion.towns.filter(town => 
        town.owner === gameState.current_player && !town.is_under_construction
    );
    
    // 按等级分组城镇
    const villages = playerTowns.filter(town => town.level === 'village');
    const smallCities = playerTowns.filter(town => town.level === 'small_city');
    
    let modalContent = '<div class="modal-content">';
    let hasUpgradableGroups = false;
    
    if (villages.length >= 2) {
        hasUpgradableGroups = true;
        modalContent += `
            <div class="upgrade-option">
                <button class="upgrade-choice" data-type="village">
                    合并村落升级为小城市
                    <br>
                    <small>选择两个村落进行合并（成本：150 GDP）</small>
                </button>
            </div>
        `;
    }
    
    if (smallCities.length >= 2) {
        hasUpgradableGroups = true;
        modalContent += `
            <div class="upgrade-option">
                <button class="upgrade-choice" data-type="small_city">
                    合并小城市升级为大城市
                    <br>
                    <small>选择两个小城市进行合并（成本：400 GDP）</small>
                </button>
            </div>
        `;
    }
    
    if (!hasUpgradableGroups) {
        showMessage('当前区域没有可升级的城镇');
        return;
    }
    
    modalContent += `
        <p class="modal-note">点击选择要进行的升级类型，然后在地图上选择要合并的城镇</p>
        </div>
    `;
    
    showModal('升级城镇', modalContent, null);
    
    // 为升级选项按钮添加事件监听器
    document.querySelectorAll('.upgrade-choice').forEach(button => {
        button.addEventListener('click', function() {
            const type = this.dataset.type;
            console.log(`点击了升级选项: ${type}, 即将进入升级模式`);
            startTownUpgradeMode(type);
            closeModal();
            console.log(`模态框关闭后的升级模式状态:`, {
                upgradeTownMode: upgradeTownMode,
                currentUpgradeType: currentUpgradeType
            });
        });
    });
}

/**
 * 进入城镇升级模式
 */
function startTownUpgradeMode(type) {
    console.log('开始进入城镇升级模式，类型:', type);
    
    // 先完全重置所有状态
    upgradeTownMode = false;
    window.upgradeTownMode = false;
    currentUpgradeType = null;
    window.currentUpgradeType = null;
    selectedTowns = [];
    window.selectedTowns = [];
    
    // 清除所有已有的高亮
    clearAllTownHighlights();
    
    // 然后设置新的状态
    upgradeTownMode = true;
    window.upgradeTownMode = true;
    
    currentUpgradeType = type;
    window.currentUpgradeType = type;
    
    // 显示提示信息
    const typeText = type === 'village' ? '村落' : '小城市';
    showMessage(`请在地图上选择第一个要合并的${typeText}`);
    
    // 更新按钮状态
    updateActionButtons();
    
    // 添加调试日志
    console.log('城镇升级模式已启动:', {
        type: type,
        upgradeTownMode: upgradeTownMode,
        currentUpgradeType: currentUpgradeType,
        selectedTowns: selectedTowns.length
    });
}

/**
 * 清除所有城镇高亮效果
 */
function clearAllTownHighlights() {
    // 清除所有带有town-upgrade-selected类的元素
    const highlightedTowns = document.querySelectorAll(".town-upgrade-selected");
    highlightedTowns.forEach(element => {
        element.classList.remove("town-upgrade-selected");
    });
    
    console.log(`已清除${highlightedTowns.length}个城镇高亮`);
}

/**
 * 处理城镇升级点击事件
 */
function handleTownUpgradeClick(q, r, s, clickedTown) {
    if (!upgradeTownMode) return;
    
    console.log('处理城镇升级点击:', q, r, s, clickedTown);
    
    // 确保clickedTown是有效的
    if (!clickedTown || !clickedTown.name) {
        console.error('无效的城镇数据:', clickedTown);
        return;
    }
    
    // 获取当前区域
    const currentRegion = window.selectedRegion;
    if (!currentRegion) {
        console.error('未选择区域');
        return;
    }
    
    // 检查是否已经选择了两个城镇
    if (!window.selectedTowns) {
        window.selectedTowns = [];
    }
    
    if (window.selectedTowns.length >= 2) {
        console.log('已经选择了两个城镇，不能再选择更多');
        return;
    }
    
    // 检查是否已经选择过这个城镇
    const alreadySelected = window.selectedTowns.some(town => 
        town && town.name === clickedTown.name
    );
    
    if (alreadySelected) {
        console.log('这个城镇已经被选择过了');
        return;
    }
    
    // 将城镇添加到选中列表
    window.selectedTowns.push({
        name: clickedTown.name,
        coords: {q, r, s},
        level: clickedTown.level
    });
    
    console.log('已选择城镇:', window.selectedTowns);
    
    // 高亮显示选中的城镇
    const hexKey = `${q},${r},${s}`;
    if (hexGrid.hexagons[hexKey]) {
        hexGrid.hexagons[hexKey].group.classList.add('selected-for-upgrade');
    }
    
    // 如果已经选择了两个城镇，显示确认对话框
    if (window.selectedTowns.length === 2) {
        // 验证两个城镇的等级是否相同
        if (window.selectedTowns[0].level !== window.selectedTowns[1].level) {
            showMessage('只能合并相同等级的城镇');
            // 清除选择
            clearAllTownHighlights();
            window.selectedTowns = [];
            return;
        }
        
        // 验证两个城镇是否在同一区域
        const region = window.selectedRegion;
        if (!region) {
            showMessage('请先选择一个区域');
            return;
        }
        
        // 准备升级确认对话框的内容
        const townType = window.selectedTowns[0].level; // 两个城镇等级相同
        
        // 显示确认对话框
        showModal(
            '确认升级城镇',
            `您确定要将以下村落合并升级为小城市吗？<br>
            ${window.selectedTowns[0].name} (位置: ${window.selectedTowns[0].coords.q},${window.selectedTowns[0].coords.r})<br>
            ${window.selectedTowns[1].name} (位置: ${window.selectedTowns[1].coords.q},${window.selectedTowns[1].coords.r})<br>
            升级后将占据原两个城镇的所有格子<br>
            新城镇名称: ${window.selectedTowns[0].name} - ${window.selectedTowns[1].name}<br>
            升级成本: ${townType === 'village' ? '150' : '400'} GDP<br>
            <br>
            注意：<br>
            • 升级需要一回合建设时间<br>
            • 已动员兵力的城镇不能参与升级<br>
            • 升级后将合并人口，但不合并已动员兵力`,
            () => {
                // 执行升级操作
                upgradeTowns(region.id, [window.selectedTowns[0].coords, window.selectedTowns[1].coords], townType)
                    .then(() => {
                        // 升级成功后清除选择状态
                        clearAllTownHighlights();
                        window.selectedTowns = [];
                        exitTownUpgradeMode();
                    })
                    .catch(error => {
                        console.error('升级失败:', error);
                        // 发生错误时也清除选择状态
                        clearAllTownHighlights();
                        window.selectedTowns = [];
                        exitTownUpgradeMode();
                    });
            }
        );
    }
}

/**
 * 退出城镇升级模式
 */
function exitTownUpgradeMode() {
    console.log('退出城镇升级模式，当前状态:', {
        upgradeTownMode,
        currentUpgradeType,
        selectedTowns: selectedTowns.length
    });
    
    // 重置所有模式变量
    upgradeTownMode = false;
    // 同步到全局变量
    window.upgradeTownMode = false;
    
    currentUpgradeType = null;
    // 同步到全局变量
    window.currentUpgradeType = null;
    
    // 清除所有选中的城镇
    selectedTowns = [];
    
    // 清除所有高亮
    clearAllTownHighlights();
    
    console.log('城镇升级模式已退出');
}

/**
 * 检查是否有同名城镇格子
 * @param {string} townName 城镇名称
 * @param {Array} hexTiles 所有格子
 * @returns {Array} 所有引用该城镇的格子
 */
function findAllTownHexes(townName, regions) {
    const results = [];
    
    for (const region of regions) {
        if (region.hex_tiles) {
            for (const hex of region.hex_tiles) {
                if (hex.town && hex.town === townName) {
                    results.push({
                        q: hex.q,
                        r: hex.r,
                        s: hex.s,
                        region_id: region.id
                    });
                }
            }
        }
        
        if (region.towns) {
            for (const town of region.towns) {
                if (town.name === townName) {
                    for (const hex of region.hex_tiles) {
                        if (hex.town === town.name) {
                            const already = results.some(r => 
                                r.q === hex.q && r.r === hex.r && r.s === hex.s
                            );
                            if (!already) {
                                results.push({
                                    q: hex.q,
                                    r: hex.r,
                                    s: hex.s,
                                    region_id: region.id
                                });
                            }
                        }
                    }
                }
            }
        }
    }
    
    return results;
}

/**
 * 检查坐标点是否属于合并城镇的任一格子
 * @param {Object} coords 坐标点 {q, r, s}
 * @param {Object} region 区域对象
 * @returns {Object|null} 如果属于合并城镇则返回城镇对象，否则返回null
 */
function isMergedTownHex(coords, region) {
    if (!region || !region.towns || !region.hex_tiles) return null;
    
    // 首先找出合并后的城镇（名称中包含" - "）
    const mergedTowns = region.towns.filter(town => town.name.includes(' - '));
    
    for (const town of mergedTowns) {
        // 检查该坐标是否对应该合并城镇的任何格子
        const hexTiles = region.hex_tiles.filter(hex => {
            if (!hex.town) return false;
            
            // 如果hex.town是对象，则比较name属性
            if (typeof hex.town === 'object') {
                return hex.town.name === town.name;
            } 
            // 如果hex.town是字符串，直接比较
            return hex.town === town.name;
        });
        
        // 检查点击的坐标是否在这些格子中
        if (hexTiles.some(hex => hex.q === coords.q && hex.r === coords.r && hex.s === coords.s)) {
            return town;
        }
    }
    
    return null;
}

/**
 * 清除所有区域高亮效果
 */
function clearAllRegionHighlights() {
    // 清除所有区域高亮类
    const allHighlights = document.querySelectorAll(".region-fr-highlight, .region-be-highlight, .region-ge-highlight, .in-region");
    allHighlights.forEach(element => {
        element.classList.remove("region-fr-highlight", "region-be-highlight", "region-ge-highlight", "in-region");
        // 重置所有高亮效果
        element.style.stroke = '#333333';
        element.style.strokeWidth = '1px';
        element.style.fill = 'rgba(255,255,255,0.2)';
    });
    
    // 重置所有背景图片的明亮效果
    const allBgImages = document.querySelectorAll(".hex-background");
    allBgImages.forEach(image => {
        image.style.filter = '';
    });
}

/**
 * 彻底清除所有高亮效果（包括区域和格子高亮）
 */
function clearAllHighlights() {
    console.log("执行清除所有高亮...");
    
    // 防止hexGrid未初始化
    if (!window.hexGrid || !window.hexGrid.hexagons) {
        console.error("hexGrid或其hexagons未初始化，无法清除高亮");
        return;
    }

    // 获取所有带有高亮类的元素
    const highlightedHexes = document.querySelectorAll('.in-region, .region-fr-highlight, .region-be-highlight, .region-ge-highlight, .clicked-hex-highlight');
    console.log(`找到 ${highlightedHexes.length} 个带有高亮类的元素`);

    // 移除高亮类
    highlightedHexes.forEach(hex => {
        hex.classList.remove('in-region', 'region-fr-highlight', 'region-be-highlight', 'region-ge-highlight', 'clicked-hex-highlight');
        hex.style.stroke = '';
        hex.style.strokeWidth = '';
        hex.style.filter = '';
        hex.style.fillOpacity = '';
    });

    // 遍历所有六边形，确保清除所有样式
    for (const hexId in window.hexGrid.hexagons) {
        const hex = window.hexGrid.hexagons[hexId];
        if (hex && hex.element) {
            hex.element.classList.remove('in-region', 'region-fr-highlight', 'region-be-highlight', 'region-ge-highlight', 'clicked-hex-highlight');
            hex.element.style.stroke = '';
            hex.element.style.strokeWidth = '';
            hex.element.style.filter = '';
            hex.element.style.fillOpacity = '';
            
            // 如果有背景图片，恢复亮度
            const bgImage = hex.group?.querySelector(".hex-background");
            if (bgImage) {
                bgImage.style.filter = '';
            }
        }
    }
    
    console.log("高亮清除完成");
}

/**
 * 处理城镇点击事件
 * @param {number} q 列坐标
 * @param {number} r 行坐标
 * @param {number} s 第三坐标
 * @param {Object} town 城镇信息
 */
function handleTownClick(q, r, s, town) {
    if (!town) return;
    
    console.log(`点击了城镇: ${town.name}, 等级: ${town.level}, 所有者: ${town.owner}, 坐标: (${q},${r},${s})`);
    console.log(`详细城镇数据:`, town);
    
    // 获取实际城镇名称（检查是否为合并城镇的其他位置）
    let actualTownName = town.name;
    
    // 检查是否为合并城镇的其他位置
    if (window.mergedTownLocations) {
        for (const [mergedName, info] of Object.entries(window.mergedTownLocations)) {
            if (info.locations && info.locations.some(loc => 
                loc.q === parseInt(q) && loc.r === parseInt(r) && 
                (loc.s === parseInt(s) || loc.s === -(parseInt(q) + parseInt(r))))) {
                actualTownName = mergedName;
                console.log(`找到实际的合并城镇名称: ${actualTownName} (点击坐标: ${q},${r},${s})`);
                break;
            }
        }
    }
    
    // 如果实际名称与传入的town名称不同，尝试从游戏状态获取完整城镇数据
    if (actualTownName !== town.name) {
        // 在游戏状态中查找完整的城镇数据
        let foundTown = null;
        if (window.gameState && window.gameState.regions) {
            for (const region of window.gameState.regions) {
                if (region.towns) {
                    foundTown = region.towns.find(t => t.name === actualTownName);
                    if (foundTown) break;
                }
            }
        }
        
        // 如果找到了更准确的城镇数据，使用它
        if (foundTown) {
            console.log(`使用更准确的城镇数据:`, foundTown);
            town = foundTown;
        }
    }
    
    // 更新城镇信息显示
    updateClickedHexInfo({q, r, s}, town);
    
    // 如果处于任何建设模式，只执行相应的建设功能，不显示信息框
    if (upgradeTownMode) {
        console.log("处理城镇升级模式点击");
        handleTownUpgradeClick(q, r, s, town);
        return; // 直接返回，不显示信息框
    } else if (buildingTownMode) {
        console.log("当前处于建造城镇模式，不显示城镇信息");
        return; // 直接返回，不显示信息框
    } else if (railwayBuildMode) {
        console.log("当前处于建造铁路模式，不显示城镇信息");
        return; // 直接返回，不显示信息框
    } else if (troopMobilizeMode) {
        console.log("当前处于动员军队模式，不显示城镇信息");
        return; // 直接返回，不显示信息框
    }
    
    // 当没有开启任何建造功能时，才显示城镇详细信息对话框
    // 转换城镇等级为中文显示
    const levelMap = {
        'village': '村落',
        'small_city': '小城市',
        'large_city': '大城市'
    };
    const displayLevel = levelMap[town.level] || town.level;
    
    // 根据城镇等级确定GDP产出
    const gdpMap = {
        'village': 20,
        'small_city': 50, 
        'large_city': 120
    };
    const gdpOutput = gdpMap[town.level] || 0;
    
    // 确保人口数据有效
    const population = town.population !== undefined ? town.population : 0;
    
    // 查找该城镇所有相关位置
    const allPositions = [];
    // 检查是否为合并城镇
    if (town.name && town.name.includes(' - ') && window.mergedTownLocations && window.mergedTownLocations[town.name]) {
        const locations = window.mergedTownLocations[town.name].locations || [];
        locations.forEach(loc => {
            allPositions.push(`(${loc.q}, ${loc.r}, ${loc.s || -(loc.q + loc.r)})`);
        });
    } else {
        // 非合并城镇，只有一个位置
        allPositions.push(`(${q}, ${r}, ${s})`);
    }
    
    // 创建城镇详细信息HTML
    const townInfoHTML = `
        <div class="town-detail-info">
            <h3>${town.name}</h3>
            <p><strong>等级:</strong> ${displayLevel}</p>
            <p><strong>所属:</strong> ${town.owner}</p>
            <p><strong>人口:</strong> ${population} 万</p>
            <p><strong>GDP产出:</strong> ${gdpOutput} 万/回合</p>
            <p><strong>位置:</strong> ${allPositions.join(', ')}</p>
            ${town.coords ? `<p><strong>记录坐标:</strong> (${town.coords.q}, ${town.coords.r}, ${town.coords.s || -(town.coords.q + town.coords.r)})</p>` : ''}
            ${town.is_under_construction ? '<p class="under-construction">该城镇正在建设中</p>' : ''}
            ${town.mobilized ? `<p><strong>已动员兵力:</strong> ${town.mobilized} 万</p>` : ''}
        </div>
    `;
    
    // 显示模态对话框
    showModal(`${town.name} 详细信息 [坐标:(${q},${r},${s})]`, townInfoHTML);
}

/**
 * 生成合并城镇名称
 * @param {string} town1Name 第一个城镇名称
 * @param {string} town2Name 第二个城镇名称
 * @returns {string} 合并后的城镇名称
 */
function generateMergedTownName(town1Name, town2Name) {
    // 如果城镇名称包含编号（如"法01号城"），提取编号
    const getNumber = (name) => {
        const match = name.match(/\d+/);
        return match ? match[0] : '';
    };
    
    // 获取两个城镇的前缀（如"法"、"比"、"德"）
    const getPrefix = (name) => {
        if (name.startsWith('法')) return '法';
        if (name.startsWith('比')) return '比';
        if (name.startsWith('德')) return '德';
        return '';
    };
    
    const prefix = getPrefix(town1Name) || getPrefix(town2Name);
    const num1 = getNumber(town1Name);
    const num2 = getNumber(town2Name);
    
    // 如果两个城镇都有编号，使用编号组合
    if (num1 && num2) {
        return `${prefix}${num1}-${num2}城`;
    }
    
    // 否则使用简短的合并名称
    return `${prefix}联合城`;
}

/**
 * 升级城镇
 * @param {string} regionId 区域ID
 * @param {Object} coords 坐标对象，包含q,r
 * @param {string} townType 要升级到的城镇类型
 */
function upgradeTown(regionId, coords, townType) {
    // 确保数据完整
    if (!regionId || !coords || !townType) {
        showMessage("升级城镇数据不完整，请重试。");
        return;
    }
    
    // 创建请求数据对象
    const data = {
        regionId: regionId,
        coords: coords,
        townType: townType
    };
    
    // 在发送请求前生成合并城镇名称
    const town1 = window.selectedTowns[0];
    const town2 = window.selectedTowns[1];
    const mergedName = generateMergedTownName(town1.name, town2.name);
    
    // 发送升级请求
    fetch('/api/upgrade-town', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            region_id: regionId,
            town1_name: town1.name,
            town2_name: town2.name,
            merged_name: mergedName,  // 添加合并后的名称
            coords: coords,
            player: gameState.current_player
        })
    })
    .then(response => {
        if (!response.ok) {
            // 尝试解析错误响应
            return response.text().then(text => {
                console.error("升级城镇请求失败:", {
                    status: response.status,
                    statusText: response.statusText,
                    responseText: text
                });
                
                try {
                    // 尝试将响应解析为JSON
                    const errorData = JSON.parse(text);
                    throw new Error(errorData.error || `请求失败: ${response.status}`);
                } catch (parseError) {
                    // 如果不是JSON，则直接返回文本
                    throw new Error(`请求失败: ${response.status}, 响应: ${text}`);
                }
            });
        }
        return response.json();
    })
    .then(result => {
        console.log("城镇升级结果:", result);
        
        if (result.success) {
            addLogEntry(`成功将 ${result.townName} 升级为 ${townType}！`);
            
            // 更新游戏状态
            fetchGameState().then(() => {
                // 刷新后，找到并高亮所有合并的城镇格子
                const mergedTownHexes = findAllTownHexes(result.townName, window.gameState.regions);
                
                if (hexGrid && mergedTownHexes.length > 0) {
                    // 清除现有高亮
                    hexGrid.clearAllTownHighlights();
                    
                    // 在地图上高亮显示所有合并的格子
                    mergedTownHexes.forEach(hex => {
                        const q = hex.coords.q;
                        const r = hex.coords.r;
                        const s = hex.coords.s || -(q + r);
                        
                        const hexKey = `${q},${r},${s}`;
                        const hexObj = hexGrid.hexagons[hexKey];
                        
                        if (hexObj) {
                            const hexIcon = hexObj.group.querySelector(".town-icon");
                            if (hexIcon) {
                                hexIcon.classList.add("town-merge-highlight");
                            }
                            hexObj.element.classList.add("town-merge-hex-highlight");
                        }
                    });
                    
                    // 临时显示成功消息
                    showTempMessage("城镇升级成功！");
                }
            });
        } else {
            // 显示错误信息
            showMessage(result.message || "升级城镇失败，请重试。");
        }
    })
    .catch(error => {
        console.error("升级城镇失败:", error);
        showMessage("升级城镇请求失败，请检查网络连接并重试。");
    });
}

/**
 * 查找所有具有相同名称的城镇格子
 * @param {string} townName 城镇名称
 * @param {Array} regions 区域数组
 * @returns {Array} 合并城镇的所有格子数组
 */
function findAllTownHexes(townName, regions) {
    if (!regions || !townName) return [];
    
    const result = [];
    
    // 遍历所有区域
    regions.forEach(region => {
        if (region.towns && region.towns.length > 0) {
            region.towns.forEach(town => {
                if (town.name === townName && town.coords) {
                    // 添加城镇格子到结果中
                    result.push({
                        regionId: region.id,
                        townName: town.name,
                        townLevel: town.level,
                        coords: town.coords
                    });
                }
            });
        }
    });
    
    return result;
}

/**
 * 判断是否是合并城镇的一部分
 * @param {Object} coords 坐标
 * @param {Object} region 区域
 * @returns {boolean} 是否是合并城镇的一部分
 */
function isMergedTownHex(coords, region) {
    if (!region || !region.towns || !coords) return false;
    
    // 寻找所有同名城镇
    const sameTownHexes = [];
    
    region.towns.forEach(town => {
        if (town.coords) {
            sameTownHexes.push(town);
        }
    });
    
    // 分组合并的城镇
    const townGroups = {};
    sameTownHexes.forEach(town => {
        if (!townGroups[town.name]) {
            townGroups[town.name] = [];
        }
        townGroups[town.name].push(town);
    });
    
    // 检查传入的坐标是否是合并城镇的一部分
    for (const townName in townGroups) {
        const townGroup = townGroups[townName];
        if (townGroup.length > 1) {
            // 是合并城镇（多个格子）
            for (const town of townGroup) {
                if (town.coords.q === coords.q && town.coords.r === coords.r) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

/**
 * 显示临时消息
 * @param {string} message 消息内容
 * @param {number} duration 显示时长，默认3秒
 */
function showTempMessage(message, duration = 3000) {
    // 检查是否已有临时消息元素
    let tempMsg = document.querySelector('.temp-message');
    
    // 如果已存在，先移除
    if (tempMsg) {
        document.body.removeChild(tempMsg);
    }
    
    // 创建新的临时消息元素
    tempMsg = document.createElement('div');
    tempMsg.className = 'temp-message';
    tempMsg.textContent = message;
    
    // 添加到页面
    document.body.appendChild(tempMsg);
    
    // 设置定时器，自动隐藏
    setTimeout(() => {
        if (tempMsg.parentNode) {
            document.body.removeChild(tempMsg);
        }
    }, duration);
}

/**
 * 更新地图状态和UI
 * @param {Object} gameState 游戏状态数据
 */
function updateMap(gameState) {
    if (!gameState || !hexGrid) return;
    
    console.log("更新地图...");
    
    // 备份当前的合并城镇数据
    const mergedTownBackup = JSON.parse(JSON.stringify(window.mergedTownLocations || {}));
    console.log("备份当前的合并城镇数据:", mergedTownBackup);
    
    // 更新基本地图
    hexGrid.updateMap(gameState, true);
    
    // 确保所有选中区域的格子显示正确
    if (window.selectedRegion) {
        const updatedRegion = gameState.regions.find(r => r.id === window.selectedRegion.id);
        if (updatedRegion) {
            window.selectedRegion = updatedRegion;
            updateRegionInfo();
        }
    }
    
    // 处理合并城镇的显示
    console.log("处理合并城镇的多位置显示...");
    
    // 创建新的合并城镇数据对象，但保留之前的数据
    if (!window.mergedTownLocations) {
        window.mergedTownLocations = {};
    }
    
    // 首先恢复之前的所有合并城镇数据
    for (const [townName, townInfo] of Object.entries(mergedTownBackup)) {
        // 检查该城镇是否仍然存在于游戏状态中
        let townExists = false;
        let foundTown = null;
        let foundRegion = null;
        
        for (const region of gameState.regions) {
            if (region.towns) {
                foundTown = region.towns.find(t => t.name === townName);
                if (foundTown) {
                    townExists = true;
                    foundRegion = region;
                    break;
                }
            }
        }
        
        if (townExists) {
            // 更新城镇信息，确保level和owner是最新的
            window.mergedTownLocations[townName] = {
                ...townInfo,
                level: foundTown.level,
                owner: foundTown.owner,
                is_under_construction: foundTown.is_under_construction,
                gdp: foundTown.level === 'large_city' ? 500 : 
                     foundTown.level === 'small_city' ? 200 : 75
            };
            
            console.log(`恢复合并城镇数据: ${townName}`, window.mergedTownLocations[townName]);
            
            // 为每个位置添加城镇图标
            townInfo.locations.forEach(loc => {
                hexGrid.addTown(
                    loc.q,
                    loc.r,
                    loc.s,
                    townName,
                    foundTown.owner,
                    foundTown.level
                );
                
                // 添加合并城镇的标记
                const hexKey = `${loc.q},${loc.r},${loc.s}`;
                const hex = hexGrid.hexagons[hexKey];
                if (hex) {
                    const iconElement = hex.group.querySelector('.town-icon');
                    if (iconElement) {
                        iconElement.classList.add('merged-town');
                        iconElement.setAttribute('data-town-name', townName);
                        iconElement.setAttribute('data-town-level', foundTown.level);
                        
                        // 如果城镇正在建设中，添加相应的样式
                        if (foundTown.is_under_construction) {
                            iconElement.classList.add('under-construction');
                        } else {
                            iconElement.classList.remove('under-construction');
                        }
                    }
                }
                
                // 如果这是一个格子所在的区域，确保hex_tiles中也标记了这个城镇
                if (foundRegion && foundRegion.hex_tiles) {
                    const hexTile = foundRegion.hex_tiles.find(h => 
                        h.q === loc.q && h.r === loc.r && 
                        (h.s === loc.s || h.s === -(loc.q + loc.r))
                    );
                    if (hexTile) {
                        hexTile.town = {
                            name: townName,
                            level: foundTown.level,
                            owner: foundTown.owner,
                            is_under_construction: foundTown.is_under_construction
                        };
                    }
                }
            });
        }
    }
    
    // 更新UI
    updatePlayerResources();
    updateActionButtons();
}

// 当页面加载完成时初始化游戏
document.addEventListener('DOMContentLoaded', initGame); 

/**
 * 调试函数：检查或手动设置升级模式状态
 * @param {boolean} enable 是否启用升级模式
 * @param {string} type 可选，升级类型
 * @returns {object} 当前状态
 */
function debugUpgradeMode(enable, type) {
    console.log("当前升级模式状态:", {
        upgradeTownMode: upgradeTownMode,
        currentUpgradeType: currentUpgradeType,
        selectedTowns: selectedTowns,
        selectedRegion: selectedRegion ? selectedRegion.id : null
    });
    
    // 如果提供了参数，则设置升级模式
    if (typeof enable === 'boolean') {
        upgradeTownMode = enable;
        
        if (enable && type) {
            currentUpgradeType = type;
            selectedTowns = [];
            
            const typeText = type === 'village' ? '村落' : '小城市';
            showMessage(`已手动激活升级${typeText}模式，请在地图上选择要合并的${typeText}`);
        } else if (!enable) {
            // 退出升级模式
            exitTownUpgradeMode();
        }
        
        console.log("设置后的升级模式状态:", {
            upgradeTownMode: upgradeTownMode,
            currentUpgradeType: currentUpgradeType,
            selectedTowns: selectedTowns
        });
    }
    
    return {
        upgradeTownMode: upgradeTownMode,
        currentUpgradeType: currentUpgradeType,
        selectedTowns: selectedTowns,
        railwayBuildMode: railwayBuildMode,
        buildingTownMode: buildingTownMode,
        troopMobilizeMode: troopMobilizeMode
    };
}

// 暴露给全局以便在控制台中调用
window.debugUpgradeMode = debugUpgradeMode;

/**
 * 执行城镇升级操作
 * @param {string} regionId 区域ID
 * @param {Array} coords 两个城镇的坐标数组
 * @param {string} townType 城镇类型，'village'或'small_city'
 * @returns {Promise} 返回升级操作的Promise对象
 */
function upgradeTowns(regionId, coords, townType) {
    // 获取当前玩家
    const player = gameState.current_player;
    
    // 根据城镇类型确定升级成本
    const upgradeCost = townType === 'village' ? 150 : 400;
    
    // 检查坐标数组是否有效
    if (!coords || !Array.isArray(coords) || coords.length < 2) {
        console.error('升级城镇错误：无效的坐标数组', coords);
        showMessage('升级失败：城镇坐标数据不完整');
        return Promise.reject(new Error('无效的坐标数组'));
    }
    
    // 调试信息 - 输出完整的坐标数据
    console.log('升级城镇详细坐标数据:', JSON.stringify(coords));
    console.log('选中的城镇:', window.selectedTowns);
    
    // 确保有选中的城镇
    if (!window.selectedTowns || window.selectedTowns.length < 2 || 
        !window.selectedTowns[0] || !window.selectedTowns[1] || 
        !window.selectedTowns[0].name || !window.selectedTowns[1].name) {
        console.error('升级城镇错误：未选择足够的城镇或城镇数据不完整');
        showMessage('升级失败：请选择两个有效的城镇');
        return Promise.reject(new Error('城镇数据不完整'));
    }
    
    // 备份当前的合并城镇数据
    const mergedTownBackup = JSON.parse(JSON.stringify(window.mergedTownLocations || {}));
    console.log('备份当前的合并城镇数据:', mergedTownBackup);
    
    // 收集所有原始城镇的位置信息
    const allLocations = [];
    
    // 遍历选中的城镇，收集它们的所有位置
    for (const selectedTown of window.selectedTowns) {
        // 检查是否是已经合并的城镇
        if (mergedTownBackup[selectedTown.name]) {
            // 如果是合并城镇，添加其所有位置
            allLocations.push(...mergedTownBackup[selectedTown.name].locations);
            console.log(`收集合并城镇 ${selectedTown.name} 的位置:`, mergedTownBackup[selectedTown.name].locations);
        } else {
            // 如果是普通城镇，添加其单个位置
            allLocations.push({
                q: parseInt(selectedTown.coords.q),
                r: parseInt(selectedTown.coords.r),
                s: parseInt(selectedTown.coords.s || -(selectedTown.coords.q + selectedTown.coords.r))
            });
            console.log(`收集普通城镇 ${selectedTown.name} 的位置:`, selectedTown.coords);
        }
    }
    
    console.log('收集到的所有位置:', allLocations);
    
    // 准备请求数据
    const requestData = {
        region_id: regionId,
        town1_name: window.selectedTowns[0].name,
        town2_name: window.selectedTowns[1].name,
        town1_q: parseInt(coords[0].q),
        town1_r: parseInt(coords[0].r),
        town1_s: parseInt(coords[0].s || -(coords[0].q + coords[0].r)),
        town2_q: parseInt(coords[1].q),
        town2_r: parseInt(coords[1].r),
        town2_s: parseInt(coords[1].s || -(coords[1].q + coords[1].r)),
        player: player,
        upgrade_type: townType,
        all_locations: allLocations  // 添加所有位置信息到请求中
    };
    
    console.log('发送升级请求:', requestData);
    
    // 发送升级请求，并返回Promise对象
    return fetch('/api/upgrade-town', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
    })
    .then(response => {
        if (!response.ok) {
            return response.json().then(data => {
                throw new Error(data.error || '升级失败');
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            const upgradeType = townType === 'village' ? '小城市' : '大城市';
            showMessage(`城镇成功合并升级为${upgradeType}！`);
            addLogEntry(`${player}在${regionId}区域将${window.selectedTowns[0].name}和${window.selectedTowns[1].name}合并升级为${upgradeType}`);
            
            // 更新游戏状态
            gameState = data.game_state;
            window.gameState = data.game_state;
            
            // 记录新合并的城镇信息
            const newTownName = `${window.selectedTowns[0].name} - ${window.selectedTowns[1].name}`;
            if (!window.mergedTownLocations) {
                window.mergedTownLocations = {};
            }
            
            // 保存新合并城镇的所有位置信息
            window.mergedTownLocations[newTownName] = {
                regionId: regionId,
                level: townType === 'village' ? 'small_city' : 'large_city',
                owner: player,
                locations: allLocations,  // 使用收集到的所有位置
                mergeTimestamp: Date.now()
            };
            
            // 恢复之前的合并城镇数据（除了被合并的城镇）
            for (const [townName, townInfo] of Object.entries(mergedTownBackup)) {
                if (townName !== newTownName && 
                    townName !== window.selectedTowns[0].name && 
                    townName !== window.selectedTowns[1].name) {
                    window.mergedTownLocations[townName] = townInfo;
                }
            }
            
            console.log('更新后的合并城镇数据:', window.mergedTownLocations);
            
            // 记录最近升级的城镇信息，用于动画效果
            window.lastUpgradedTown = newTownName;
            window.lastUpgradeTime = Date.now();
            
            // 更新UI和地图
            updateGameStateUI();
            updateMap(gameState);
            
            // 关闭模态框
            closeModal();
            
            return data;
        } else {
            showMessage(data.error || '城镇升级失败');
            throw new Error(data.error || '城镇升级失败');
        }
    })
    .catch(error => {
        console.error('升级城镇错误:', error);
        showMessage(`升级城镇失败: ${error.message}`);
        throw error;
    });
}

// 将handleTownClick函数暴露给全局，供hexagons.js中调用
window.handleTownClick = handleTownClick;

/**
 * 显示游戏结束模态框
 */
function showGameEndModal(gameState) {
    // 防止多次显示
    if (document.getElementById('game-end-modal')) {
        return;
    }
    
    if (!gameState.winner) {
        return;
    }
    
    // 禁用所有操作按钮，除了重置游戏
    if (elements.actionButtons) {
        const buttons = elements.actionButtons.querySelectorAll('button:not(#reset-game-btn)');
        buttons.forEach(button => {
            button.disabled = true;
        });
    }
    
    // 获取胜利者颜色
    const winnerColor = gameState.winner === "德军" ? "#3498db" : "#e74c3c";
    
    // 构建HTML
    let forcesHTML = '';
    let totalForces = 0;
    
    // 计算总兵力以便显示百分比
    for (const [faction, force] of Object.entries(gameState.arrived_forces)) {
        totalForces += force;
    }
    
    for (const [faction, force] of Object.entries(gameState.arrived_forces)) {
        const isWinner = faction === gameState.winner;
        const factionColor = faction === '德军' ? '#3498db' : '#e74c3c';
        const percentage = totalForces > 0 ? Math.round((force / totalForces) * 100) : 0;
        
        forcesHTML += `
            <div class="force-entry ${isWinner ? 'winner' : 'loser'}">
                <span class="faction-name" style="color: ${factionColor};">${faction}</span>
                <div class="force-details">
                    <div class="force-bar-container">
                        <div class="force-bar" style="width: ${percentage}%; background-color: ${factionColor};"></div>
                    </div>
                    <span class="force-amount">${force} 万兵力 (${percentage}%)</span>
                    ${isWinner ? '<span class="winner-badge">胜利</span>' : ''}
                </div>
            </div>
        `;
    }
    
    const modalHTML = `
        <div id="game-end-modal" class="modal">
            <div class="modal-content game-end-modal">
                <span class="close">&times;</span>
                <h2 style="color: ${winnerColor};">${gameState.winner} 胜利！</h2>
                <p class="game-end-message">战争在第 ${gameState.round} 回合结束，决定了最终胜利者。</p>
                
                <div class="forces-info">
                    <h3>冲突地区最终兵力</h3>
                    ${forcesHTML}
                </div>
                
                <div class="victory-summary">
                    <p>点击"重置游戏"按钮开始新游戏。</p>
                </div>
            </div>
        </div>
    `;
    
    // 添加到DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // 显示模态框
    const modal = document.getElementById('game-end-modal');
    modal.style.display = 'block';
    
    // 添加关闭事件
    const closeBtn = modal.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    // 点击模态框外部也可以关闭
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // 添加兵力条动画效果
    setTimeout(() => {
        const forceBars = document.querySelectorAll('.force-bar');
        forceBars.forEach(bar => {
            bar.classList.add('animate-width');
        });
    }, 300);
}

/**
 * 初始化玩家角色
 * @param {string} faction 派系
 */
function initPlayerRole(faction) {
    console.log("初始化玩家角色:", faction);
    
    // 初始化角色能力数据
    window.roleAbilities = {
        germany: {
            name: "德意志帝国",
            standardName: "德军", // 添加标准名称映射
            image: "/static/images/German_role.png",
            quote: "铁与血的政策将铸就我们的伟大帝国",
            abilities: [
                {
                    id: "blitz_raid",
                    name: "闪电突袭",
                    description: "提高30%运输能力，持续5回合",
                    oneTimeUse: false,
                    duration: 5,
                    used: false,
                    turnsLeft: 0
                },
                {
                    id: "emergency_repairs",
                    name: "紧急修复",
                    description: "临时修复被破坏的铁路，持续5回合",
                    oneTimeUse: false,
                    duration: 5,
                    used: false,
                    turnsLeft: 0
                }
            ]
        },
        allies: {
            name: "协约国",
            standardName: "协约国", // 添加标准名称映射
            image: "/static/images/French_role.png",
            quote: "为了保卫自由与和平，我们必须团结一致",
            abilities: [
                {
                    id: "elastic_defense",
                    name: "弹性防御",
                    description: "铁路修复速度提高50%，持续5回合",
                    oneTimeUse: false,
                    duration: 5,
                    used: false,
                    turnsLeft: 0
                },
                {
                    id: "taxi_miracle",
                    name: "出租车奇迹",
                    description: "立即向前线增派军队，一次性效果",
                    oneTimeUse: true,
                    duration: 1,
                    used: false,
                    turnsLeft: 0
                }
            ]
        }
    };
    
    // 设置玩家角色对象
    if (faction === 'germany') {
        window.playerRole = window.roleAbilities.germany;
        roleImagePath = '/static/images/German_role.png';
    } else {
        window.playerRole = window.roleAbilities.allies;
        roleImagePath = '/static/images/French_role.png';
    }
    
    // 额外设置一个标准玩家ID属性用于API交互
    window.standardPlayerName = window.playerRole.standardName;
    console.log("设置标准玩家ID:", window.standardPlayerName);
    
    // 设置角色图标
    const roleIcon = document.getElementById('role-icon');
    if (roleIcon) {
        // 检查图像是否存在
        const img = new Image();
        img.onload = function() {
            console.log("角色图片加载成功:", roleImagePath);
            roleIcon.innerHTML = `<img src="${roleImagePath}" alt="${window.playerRole.name}" title="点击查看角色信息" style="width:60px; height:60px; border-radius:50%;">`;
            
            // 添加点击事件 - 直接在这里添加确保图片加载后才绑定
            roleIcon.onclick = function() {
                console.log("角色图标被点击");
                showRoleModal();
            };
        };
        img.onerror = function() {
            // 图像不存在时，使用文本替代
            console.warn("角色图片加载失败:", roleImagePath);
            roleIcon.innerHTML = `<div style="width:60px; height:60px; border-radius:50%; background-color:#333; color:white; display:flex; align-items:center; justify-content:center;">${faction === 'germany' ? 'GE' : 'FR'}</div>`;
            
            // 同样添加点击事件
            roleIcon.onclick = function() {
                console.log("角色图标被点击");
                showRoleModal();
            };
        };
        img.src = roleImagePath;
    } else {
        console.warn("找不到角色图标元素");
    }
    
    console.log(`玩家角色初始化完成: ${window.playerRole.name}, 标准ID: ${window.standardPlayerName}`);
}

/**
 * 显示角色信息弹窗
 */
function showRoleModal() {
    console.log("尝试显示角色弹窗");
    
    if (!window.playerRole) {
        console.warn("缺少playerRole数据，无法显示角色弹窗");
        return;
    }
    
    const roleModal = document.getElementById('role-modal');
    const roleModalTitle = document.getElementById('role-modal-title');
    const roleModalBody = document.getElementById('role-modal-body');
    
    if (!roleModal || !roleModalTitle || !roleModalBody) {
        console.error("找不到角色弹窗必要的DOM元素");
        return;
    }
    
    roleModalTitle.textContent = window.playerRole.name;
    
    let content = `
        <div class="role-quote">"${window.playerRole.quote}"</div>
        <div class="role-description">作为${window.playerRole.name}，您可以使用以下特殊能力：</div>
    `;
    
    // 添加各种能力
    window.playerRole.abilities.forEach(ability => {
        let abilityStatus = "";
        let buttonDisabled = "";
        
        if (ability.used && ability.oneTimeUse) {
            abilityStatus = "<span style='color:#e74c3c'>(已使用)</span>";
            buttonDisabled = "disabled";
        } else if (ability.used && ability.turnsLeft > 0) {
            abilityStatus = `<span style='color:#2ecc71'>(生效中，剩余回合: ${ability.turnsLeft})</span>`;
            buttonDisabled = "disabled";
        }
        
        content += `
            <div class="role-ability" data-ability-id="${ability.id}">
                <h4>${ability.name} ${abilityStatus}</h4>
                <p>${ability.description}</p>
                <div class="role-ability-actions">
                    <button class="use-ability-btn" data-ability-id="${ability.id}" ${buttonDisabled}>使用</button>
                </div>
            </div>
        `;
    });
    
    roleModalBody.innerHTML = content;
    
    // 为所有使用按钮添加事件
    const useButtons = roleModalBody.querySelectorAll('.use-ability-btn');
    useButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const abilityId = e.target.getAttribute('data-ability-id');
            useRoleAbility(abilityId);
        });
    });
    
    // 为关闭按钮添加事件
    const closeButton = document.querySelector('.close-role-modal');
    if (closeButton) {
        closeButton.onclick = function() {
            closeRoleModal();
        };
    }
    
    roleModal.style.display = 'block';
    console.log("角色弹窗已显示");
}

/**
 * 关闭角色弹窗
 */
function closeRoleModal() {
    const roleModal = document.getElementById('role-modal');
    if (roleModal) {
        roleModal.style.display = 'none';
    }
}

/**
 * 使用角色能力
 * @param {string} abilityId 能力ID
 */
function useRoleAbility(abilityId) {
    if (!window.playerRole) {
        console.warn("缺少playerRole数据，无法使用角色能力");
        return;
    }
    
    // 找到对应的能力
    const ability = window.playerRole.abilities.find(a => a.id === abilityId);
    if (!ability) {
        console.error("找不到能力:", abilityId);
        return;
    }
    
    // 检查能力是否已经使用过
    if (ability.used && ability.oneTimeUse) {
        showMessage("该能力已使用过，无法再次使用");
        return;
    }
    
    // 检查能力是否正在生效
    if (ability.used && ability.turnsLeft > 0) {
        showMessage(`该能力正在生效中，剩余${ability.turnsLeft}回合`);
        return;
    }
    
    console.log(`使用角色能力: ${ability.name}`);
    
    // 根据不同能力执行不同效果
    switch (abilityId) {
        case "blitz_raid":
            // 提高运输能力
            if (window.gameState) {
                window.gameState.transport_capacity_boost = 1.3; // 增加30%运输能力
                ability.used = true;
                ability.turnsLeft = ability.duration;
                showMessage("闪电突袭能力已激活！运输能力提高30%，持续5回合");
                addLogEntry("使用了闪电突袭能力，运输能力提高30%，持续5回合");
            }
            break;
        case "emergency_repairs":
            // 临时修复铁路
            ability.used = true;
            ability.turnsLeft = ability.duration;
            showMessage("紧急修复能力已激活！可临时修复被破坏的铁路，持续5回合");
            addLogEntry("使用了紧急修复能力，可临时修复被破坏的铁路，持续5回合");
            break;
        case "elastic_defense":
            // 加快铁路修复速度
            if (window.gameState) {
                window.gameState.railway_repair_boost = 1.5; // 修复速度提高50%
                ability.used = true;
                ability.turnsLeft = ability.duration;
                showMessage("弹性防御能力已激活！铁路修复速度提高50%，持续5回合");
                addLogEntry("使用了弹性防御能力，铁路修复速度提高50%，持续5回合");
            }
            break;
        case "taxi_miracle":
            // 出租车奇迹事件
            ability.used = true;
            showMessage("出租车奇迹事件已触发！前线部队得到立即增援");
            addLogEntry("触发了出租车奇迹事件，前线部队得到立即增援");
            break;
        default:
            console.error("未知的能力ID:", abilityId);
            return;
    }
    
    // 关闭弹窗
    closeRoleModal();
    
    // 更新UI
    updateGameStateUI();
}

/**
 * 更新角色能力持续时间
 */
function updateRoleAbilities() {
    if (!window.playerRole) {
        console.warn("缺少playerRole数据，无法更新角色能力");
        return;
    }
    
    window.playerRole.abilities.forEach(ability => {
        if (ability.used && ability.turnsLeft > 0) {
            ability.turnsLeft--;
            
            // 当能力效果结束时
            if (ability.turnsLeft === 0 && !ability.oneTimeUse) {
                // 恢复原有状态
                switch (ability.id) {
                    case "blitz_raid":
                        if (window.gameState) {
                            delete window.gameState.transport_capacity_boost;
                            showMessage("闪电突袭能力效果已结束");
                            addLogEntry("闪电突袭能力效果已结束");
                        }
                        break;
                    case "emergency_repairs":
                        showMessage("紧急修复能力效果已结束");
                        addLogEntry("紧急修复能力效果已结束");
                        break;
                    case "elastic_defense":
                        if (window.gameState) {
                            delete window.gameState.railway_repair_boost;
                            showMessage("弹性防御能力效果已结束");
                            addLogEntry("弹性防御能力效果已结束");
                        }
                        break;
                }
                
                // 重置使用状态，让能力可以再次使用
                ability.used = false;
            }
            
            // 如果还在生效中，显示状态
            else if (ability.turnsLeft > 0) {
                console.log(`能力 ${ability.name} 剩余 ${ability.turnsLeft} 回合`);
            }
        }
    });
}

// 更新nextRound函数，添加更新角色能力的代码
const originalNextRound = nextRound;
nextRound = function() {
    // 更新角色能力持续时间
    updateRoleAbilities();
    
    // 调用原始的nextRound函数
    originalNextRound();
};

// 添加角色图标点击事件
document.addEventListener('DOMContentLoaded', function() {
    // 角色图标点击事件
    const roleIcon = document.getElementById('role-icon');
    if (roleIcon) {
        roleIcon.addEventListener('click', () => {
            showRoleModal();
        });
    }
    
    // 角色弹窗关闭按钮
    const closeRoleModalBtn = document.querySelector('.close-role-modal');
    if (closeRoleModalBtn) {
        closeRoleModalBtn.addEventListener('click', () => {
            closeRoleModal();
        });
    }
});

/**
 * 初始化AI难度设置
 */
function initAIDifficulty() {
    // 获取难度选择器元素
    const difficultySelect = document.getElementById('ai-difficulty-select');
    if (difficultySelect) {
        // 设置默认难度
        difficultySelect.value = aiDifficulty;
        
        // 添加难度变更事件监听器
        difficultySelect.addEventListener('change', function() {
            aiDifficulty = this.value;
            console.log(`AI难度已更改为: ${aiDifficulty}`);
            addLogEntry(`AI难度已设置为: ${aiDifficulty}`);
        });
    }
}

/**
 * 玩家准备进入下一回合
 */
function readyForNextRound() {
    window.playerReady = true;
    
    // 禁用"结束回合"按钮，直到下一回合开始
    const nextRoundBtn = document.getElementById('next-round-btn');
    if (nextRoundBtn) {
        nextRoundBtn.disabled = true;
        // 设置禁用样式 
        nextRoundBtn.style.opacity = "0.5";
        nextRoundBtn.style.cursor = "not-allowed";
    }
    
    // 获取当前玩家角色
    const currentPlayer = window.playerRole || getCurrentPlayerFromURL();
    
    // 更新回合状态显示
    updateTurnStatus();
    addLogEntry('玩家准备完毕，等待AI行动');
    
    // 如果AI已经准备好，则进入下一回合
    if (window.aiReady) {
        console.log("玩家和AI都已准备好，进入下一回合");
        setTimeout(() => {
            performNextRound();
        }, 500);
    } else if (!window.aiThinking && gameState && gameState.current_player !== currentPlayer) {
        // 如果现在是AI的回合但AI还没开始思考，触发AI决策
        console.log("触发AI决策...");
        triggerAIDecision();
    } else {
        console.log("等待AI完成决策...");
    }
}

/**
 * 触发AI决策
 */
function triggerAIDecision() {
    if (!aiEnabled || !gameState) return;
    
    // 显示AI思考中的动画
    showAIThinking(true);
    aiThinking = true;
    
    // 模拟AI思考时间（根据难度调整，但设置上限为防止卡顿）
    const thinkingTime = aiDifficulty === 'easy' ? 1000 : 
                        (aiDifficulty === 'medium' ? 1500 : 2000);
    
    // 添加AI决策超时处理
    const aiTimeout = setTimeout(() => {
        if (aiThinking) {
            console.warn("AI决策超时，强制结束");
            window.aiReady = true;
            window.aiThinking = false;
            showAIThinking(false);
            updateTurnStatus();
            addLogEntry(`AI决策超时，跳过本回合`);
            
            // 强制将回合控制权交给玩家
            setTimeout(() => {
                let playerStr = window.standardPlayerName || "德军";
                console.log("AI超时后转换回合给玩家:", playerStr);
                
                if (gameState) {
                    gameState.current_player = playerStr;
                    window.gameState.current_player = playerStr;
                    updateTurnStatus();
                    // 更新玩家资源显示
                    updatePlayerResources();
                    
                    // 启用回合结束按钮
                    const nextRoundBtn = document.getElementById('next-round-btn');
                    if (nextRoundBtn) {
                        nextRoundBtn.disabled = false;
                        nextRoundBtn.style.opacity = "1";
                        nextRoundBtn.style.cursor = "pointer";
                    }
                }
            }, 500);
        }
    }, 10000); // 10秒后超时
    
    setTimeout(() => {
        console.log("AI开始决策...");
        
        // 异步执行AI策略
        const executeAIStrategy = async () => {
            try {
                // 根据当前游戏阶段执行不同策略
                const phase = gameState.phase || '';
                let actionTaken = false;
                
                // 添加性能日志
                console.time('AI决策执行时间');
                
                if (phase === 'construction' || phase === '建设期' || phase === '保护期') {
                    actionTaken = await aiConstructionStrategy();
                } else if (phase === 'mobilization' || phase === '动员期') {
                    actionTaken = await aiMobilizationStrategy();
                } else if (phase === 'war' || phase === '战争期') {
                    actionTaken = await aiWarStrategy();
                }
                
                console.timeEnd('AI决策执行时间');
                
                // 清除超时计时器
                clearTimeout(aiTimeout);
                
                // AI回合结束
                console.log("AI决策完成，是否执行了行动:", actionTaken);
                
                // 无论是否执行了行动，都标记AI为已准备好
                window.aiReady = true;
                window.aiThinking = false;
                showAIThinking(false);
                
                // 更新回合状态显示
                updateTurnStatus();
                
                // AI回合结束后，主动获取最新的游戏状态
                try {
                    await fetchGameState();
                    console.log("AI回合结束后更新游戏状态");
                    
                    // 如果玩家已准备好，自动进入下一回合
                    if (window.playerReady) {
                        setTimeout(() => {
                            console.log("玩家和AI都已准备好，进入下一回合");
                            performNextRound();
                        }, 1000);
                    } else {
                        // 如果玩家未准备好，立即将回合控制权还给玩家
                        setTimeout(() => {
                            console.log("AI行动完成，转由玩家行动");
                            
                            // 使用window.standardPlayerName作为标准玩家标识符
                            let playerStr = window.standardPlayerName || "德军";
                            
                            console.log("转换回合给玩家标准标识符:", playerStr);
                            
                            if (gameState) {
                                gameState.current_player = playerStr;
                                window.gameState.current_player = playerStr;
                                updateTurnStatus();
                                // 更新玩家资源显示
                                updatePlayerResources();
                                addLogEntry(`AI行动完成，轮到玩家(${playerStr})行动`);
                                
                                // 启用回合结束按钮
                                const nextRoundBtn = document.getElementById('next-round-btn');
                                if (nextRoundBtn) {
                                    nextRoundBtn.disabled = false;
                                    nextRoundBtn.style.opacity = "1";
                                    nextRoundBtn.style.cursor = "pointer";
                                }
                            }
                        }, 1000);
                    }
                } catch (error) {
                    console.error("AI回合结束后更新游戏状态失败:", error);
                    // 即使获取状态失败，也确保回合能继续
                    let playerStr = window.standardPlayerName || "德军";
                    console.log("获取状态失败后转换回合给玩家:", playerStr);
                    
                    if (gameState) {
                        gameState.current_player = playerStr;
                        window.gameState.current_player = playerStr;
                        updateTurnStatus();
                        updatePlayerResources();
                    }
                }
            } catch (error) {
                // 清除超时计时器
                clearTimeout(aiTimeout);
                
                console.error("AI决策出错:", error);
                window.aiThinking = false;
                showAIThinking(false);
                // 出错时也要标记AI已准备，避免游戏卡住
                window.aiReady = true;
                updateTurnStatus();
                addLogEntry(`AI决策出错: ${error.message}`);
                
                // 确保在出错情况下也更新游戏状态
                try {
                    await fetchGameState();
                } catch (fetchError) {
                    console.error("获取游戏状态失败", fetchError);
                }
                
                // 出错时也要将回合控制权还给玩家
                setTimeout(() => {
                    let playerStr = window.standardPlayerName || "德军";
                    console.log("AI错误后转换回合给玩家:", playerStr);
                    
                    if (gameState) {
                        gameState.current_player = playerStr;
                        window.gameState.current_player = playerStr;
                        updateTurnStatus();
                        // 更新玩家资源显示
                        updatePlayerResources();
                        addLogEntry(`AI处理出错，轮到玩家(${playerStr})行动`);
                        
                        // 启用回合结束按钮
                        const nextRoundBtn = document.getElementById('next-round-btn');
                        if (nextRoundBtn) {
                            nextRoundBtn.disabled = false;
                            nextRoundBtn.style.opacity = "1";
                            nextRoundBtn.style.cursor = "pointer";
                        }
                    }
                }, 1000);
            }
        };
        
        // 执行AI策略
        executeAIStrategy();
    }, thinkingTime);
}

/**
 * 显示或隐藏AI思考中的动画
 */
function showAIThinking(show) {
    const aiThinkingElem = document.getElementById('ai-thinking');
    if (aiThinkingElem) {
        aiThinkingElem.style.display = show ? 'block' : 'none';
    }
}

/**
 * 更新回合状态显示
 */
function updateTurnStatus() {
    const playerStatusElem = document.getElementById('player-status');
    const aiStatusElem = document.getElementById('ai-status');
    
    if (playerStatusElem && aiStatusElem && window.gameState) {
        // 获取标准玩家名称（德军/协约国）
        const standardPlayer = window.standardPlayerName || "德军";
        
        // 确保gameState.current_player是标准名称
        const gameStatePlayer = window.gameState.current_player;
        
        // 检查当前是否是玩家的回合（使用标准名称比较）
        const isPlayerTurn = gameStatePlayer === standardPlayer;
        
        // 更新玩家状态
        playerStatusElem.className = isPlayerTurn ? 'status-active' : 'status-waiting';
        playerStatusElem.textContent = isPlayerTurn ? '行动中' : 
                                      (window.playerReady ? '已准备' : '等待中');
        
        // 更新AI状态
        aiStatusElem.className = !isPlayerTurn ? 'status-active' : 'status-waiting';
        aiStatusElem.textContent = !isPlayerTurn ? '行动中' : 
                                  (window.aiReady ? '已准备' : '等待中');
        
        // 确定AI的标准名称
        const aiPlayer = standardPlayer === "德军" ? "协约国" : "德军";
        
        console.log("回合状态更新:", {
            玩家标准名称: standardPlayer,
            显示名称: window.playerRole ? (typeof window.playerRole === 'object' ? window.playerRole.name : window.playerRole) : "未知",
            当前玩家: gameStatePlayer,
            AI玩家: aiPlayer,
            是玩家回合: isPlayerTurn,
            是AI回合: gameStatePlayer === aiPlayer,
            玩家已准备: window.playerReady,
            AI已准备: window.aiReady
        });
        
        // 更新游戏阶段显示
        const phaseInfoElem = document.getElementById('phase-info');
        if (phaseInfoElem && window.gameState) {
            const currentRound = window.gameState.round || 1;
            let phaseText = '';
            
            // 判断并显示当前游戏阶段
            if (currentRound <= 30) {
                phaseText = '保护期';
            } else if (currentRound <= 40) {
                phaseText = '紧张期';
            }
            
            if (phaseText) {
                phaseInfoElem.textContent = phaseText;
            }
        }
        
        // 如果当前是AI的回合，但AI尚未行动且没有正在思考，则自动触发AI决策
        if (gameStatePlayer === aiPlayer && !window.aiReady && !window.aiThinking) {
            console.log("检测到AI需要行动，自动触发AI决策");
            setTimeout(() => {
                triggerAIDecision();
            }, 500);
        }
    }
}

/**
 * 执行下一回合
 */
function performNextRound() {
    console.log("执行下一回合...");
    
    // 重置状态
    window.playerReady = false;
    window.aiReady = false;
    
    // 启用"结束回合"按钮
    const nextRoundBtn = document.getElementById('next-round-btn');
    if (nextRoundBtn) {
        nextRoundBtn.disabled = false;
        // 确保按钮样式恢复正常
        nextRoundBtn.style.opacity = "1";
        nextRoundBtn.style.cursor = "pointer";
    }
    
    // 获取当前玩家标准名称
    let currentPlayer = window.standardPlayerName || "德军";
    
    // 确保是标准名称
    if (typeof currentPlayer !== 'string' || 
        (currentPlayer !== "德军" && currentPlayer !== "协约国")) {
        // 回退逻辑
        currentPlayer = "德军";
        if (window.playerRole) {
            if (typeof window.playerRole === 'object') {
                currentPlayer = window.playerRole.standardName || "德军";
            } else if (window.playerRole === 'allies' || window.playerRole.includes('协')) {
                currentPlayer = "协约国";
            }
        }
    }
    
    console.log("使用标准玩家名称执行下一回合:", currentPlayer);
    
    // 执行原始的下一回合逻辑
    fetch('/api/next-round', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            player: currentPlayer
        })
    })
    .then(response => {
        if (!response.ok) {
            return response.text().then(text => {
                try {
                    const errorData = JSON.parse(text);
                    throw new Error(errorData.error || `HTTP错误: ${response.status}`);
                } catch (e) {
                    throw new Error(`进入下一回合失败: ${text}`);
                }
            });
        }
        return response.json();
    })
    .then(data => {
        if (data.success) {
            console.log('进入下一回合成功:', data.game_state);
            window.gameState = data.game_state;
            gameState = data.game_state;
            
            // 备份当前的合并城镇数据
            const mergedTownBackup = JSON.parse(JSON.stringify(window.mergedTownLocations || {}));
            
            // 如果current_player不是标准名称，修正它
            if (gameState.current_player !== "德军" && gameState.current_player !== "协约国") {
                gameState.current_player = window.standardPlayerName || "德军";
            }
            
            // 更新UI和地图
            updateGameStateUI();
            updateMap(gameState);
            
            // 恢复合并城镇的位置信息
            restoreMergedTownLocations(mergedTownBackup);
            
            addLogEntry(`进入新回合: ${gameState.round}, 当前玩家: ${gameState.current_player}`);
            
            // 更新回合状态
            updateTurnStatus();
            
            // 如果现在是AI的回合，自动触发AI决策
            if (gameState.current_player !== currentPlayer) {
                // 给UI一些时间更新再触发AI决策
                setTimeout(() => {
                    triggerAIDecision();
                }, 1000);
            }
        } else {
            addLogEntry('进入下一回合失败');
            // 失败时也要恢复按钮状态
            if (nextRoundBtn) {
                nextRoundBtn.disabled = false;
                nextRoundBtn.style.opacity = "1";
                nextRoundBtn.style.cursor = "pointer";
            }
        }
    })
    .catch(error => {
        console.error('Error advancing round:', error);
        addLogEntry(error.message);
        // 错误时也要恢复按钮状态
        if (nextRoundBtn) {
            nextRoundBtn.disabled = false;
            nextRoundBtn.style.opacity = "1";
            nextRoundBtn.style.cursor = "pointer";
        }
    });
}

/**
 * AI建设策略
 * 基于游戏回合实现阶段性策略
 */
async function aiConstructionStrategy() {
    console.log("AI执行建设策略...");
    
    // 使用标准玩家名称确定AI阵营
    const playerStandard = window.standardPlayerName || "德军";
    const aiFaction = playerStandard === "德军" ? "协约国" : "德军";
    
    console.log("玩家标准阵营:", playerStandard, "AI标准阵营:", aiFaction);
    
    // 确定AI对应的冲突区域
    const aiConflictRegion = aiFaction === "协约国" ? "FR-3" : "GE-3";
    console.log("AI方冲突区域:", aiConflictRegion);
    
    // 获取AI可控制的区域
    const aiRegions = gameState.regions.filter(region => {
        // 为简单起见，按区域ID前缀匹配
        const prefix = region.id.substring(0, 2);
        return (aiFaction === "协约国" && prefix === "FR") || 
               (aiFaction === "德军" && (prefix === "GE" || prefix === "BE"));
    });
    
    if (aiRegions.length === 0) {
        console.log("AI没有可操作的区域");
        addLogEntry(`AI(${aiFaction})没有可操作的区域，跳过建设`);
        return false;
    }
    
    // 获取当前回合数，确定战略阶段
    const currentRound = gameState.round || 1;
    let currentStage = "";
    
    // 根据回合数确定当前策略阶段
    if (currentRound <= 10) {
        currentStage = "early"; // 早期发展 (1-10回合)
    } else if (currentRound <= 20) {
        currentStage = "mid"; // 中期扩张 (11-20回合)
    } else if (currentRound <= 30) {
        currentStage = "late"; // 后期战备 (21-30回合)
    } else {
        currentStage = "war"; // 战争阶段 (31-40回合)
    }
    
    console.log(`当前回合: ${currentRound}, 策略阶段: ${currentStage}`);
    
    // 如果当前回合AI已经有失败操作，存储在全局变量中
    if (!window.aiFailedActions) {
        window.aiFailedActions = {
            buildVillage: {},  // 存储已失败的建造位置
            upgradeTowns: {},  // 存储已失败的升级尝试
            buildRailway: {}   // 存储已失败的铁路建设尝试
        };
    }
    
    // 每次开始新回合时重置失败尝试记录
    if (window.aiLastProcessedRound !== currentRound) {
        window.aiLastProcessedRound = currentRound;
        window.aiFailedActions = {
            buildVillage: {},
            upgradeTowns: {},
            buildRailway: {}
        };
        console.log(`AI进入新回合 ${currentRound}，重置失败记录`);
    }
    
    // 跟踪已执行的操作
    let actionsPerformed = 0;
    let maxAttempts = 5; // 控制最大尝试次数，防止无限循环
    let actionPerformed = false;
    
    // 获取当前GDP
    let aiGDP = getCurrentAIGDP(aiFaction);
    
    // 计算当前阶段的资源分配比例
    let gdpReserve = 0; // 预留资金
    let buildingBudget = 0; // 建设预算
    let railwayBudget = 0;
    
    if (currentStage === "early") {
        // 早期阶段: 预留20%, 建设50%, 铁路30%
        gdpReserve = Math.floor(aiGDP * 0.2);
        buildingBudget = Math.floor(aiGDP * 0.5);
        railwayBudget = aiGDP - gdpReserve - buildingBudget;
    } else if (currentStage === "mid") {
        // 中期阶段: 预留25%, 建设40%, 铁路35%
        gdpReserve = Math.floor(aiGDP * 0.25);
        buildingBudget = Math.floor(aiGDP * 0.4);
        railwayBudget = aiGDP - gdpReserve - buildingBudget;
    } else if (currentStage === "late") {
        // 后期阶段: 预留30%, 建设35%, 铁路35%
        gdpReserve = Math.floor(aiGDP * 0.3);
        buildingBudget = Math.floor(aiGDP * 0.35);
        railwayBudget = aiGDP - gdpReserve - buildingBudget;
    } else { // war stage
        // 战争阶段: 预留70%, 建设15%, 铁路15%
        gdpReserve = Math.floor(aiGDP * 0.7); // 预留更多用于动员
        buildingBudget = Math.floor(aiGDP * 0.15);
        railwayBudget = aiGDP - gdpReserve - buildingBudget;
    }
    
    console.log(`AI(${aiFaction})GDP分配: 总计=${aiGDP}, 预留=${gdpReserve}, 建设=${buildingBudget}, 铁路=${railwayBudget}`);
    
    // 如果是第11回合，特别处理，减少尝试次数避免浏览器卡死
    if (currentRound === 11) {
        console.log("当前是第11回合，使用简化策略避免浏览器卡死");
        maxAttempts = 2; // 减少尝试次数
    }
    
    // 循环执行操作直到GDP耗尽或无可行操作
    for (let attempt = 0; attempt < maxAttempts && (buildingBudget >= 50 || railwayBudget >= 20); attempt++) {
        console.log(`AI尝试次数: ${attempt+1}/${maxAttempts}, 建设预算: ${buildingBudget}, 铁路预算: ${railwayBudget}`);
        actionPerformed = false;
        
        // 首先检查是否有铁路连接的相邻城镇，优先升级这些城镇
        if (buildingBudget >= 100) {
            console.log("检查是否有铁路连接的城镇可以升级");
            
            // 检查每个区域中通过铁路连接的AI控制的城镇
            let connectedTownsFound = false;
            let upgradableTownRegion = null;
            
            for (const region of aiRegions) {
                if (!region.towns || region.towns.length < 2 || !region.railways || region.railways.length === 0) {
                    continue; // 需要至少两个城镇和铁路才能进行检查
                }
                
                // 获取AI控制的城镇
                const aiTowns = region.towns.filter(town => {
                    const actualPlayer = aiFaction === "德军" ? "德军" : "协约国";
                    return town.owner === actualPlayer;
                });
                
                if (aiTowns.length < 2) continue;
                
                // 检查每对城镇是否通过铁路连接
                for (let i = 0; i < aiTowns.length; i++) {
                    for (let j = i + 1; j < aiTowns.length; j++) {
                        const town1 = aiTowns[i];
                        const town2 = aiTowns[j];
                        
                        // 检查这两个城镇之间是否有铁路连接
                        const hasRailway = region.railways.some(railway => 
                            (railway.start.q === town1.coords.q && 
                             railway.start.r === town1.coords.r && 
                             railway.end.q === town2.coords.q && 
                             railway.end.r === town2.coords.r) || 
                            (railway.start.q === town2.coords.q && 
                             railway.start.r === town2.coords.r && 
                             railway.end.q === town1.coords.q && 
                             railway.end.r === town1.coords.r)
                        );
                        
                        if (hasRailway) {
                            console.log(`发现铁路连接的城镇: ${town1.name} 和 ${town2.name}`);
                            connectedTownsFound = true;
                            upgradableTownRegion = region;
                            break;
                        }
                    }
                    if (connectedTownsFound) break;
                }
                
                if (connectedTownsFound) break;
            }
            
            // 如果找到了铁路连接的城镇，优先进行升级
            if (connectedTownsFound && upgradableTownRegion) {
                console.log("找到铁路连接的城镇，尝试升级城镇");
                try {
                    // 先尝试升级为大城市（如果有足够GDP）
                    if (buildingBudget >= 200) {
                        const resultCity = await aiTryUpgradeTowns([upgradableTownRegion], aiFaction, 'city');
                        if (resultCity) {
                            actionsPerformed++;
                            actionPerformed = true;
                            buildingBudget -= 200; // 升级到大城市花费200
                            console.log(`AI成功升级铁路连接城镇至大城市`);
                            continue;
                        }
                    }
                    
                    // 如果无法升级为大城市，尝试升级为小城市
                    if (!actionPerformed && buildingBudget >= 100) {
                        const result = await aiTryUpgradeTowns([upgradableTownRegion], aiFaction, 'town');
                        if (result) {
                            actionsPerformed++;
                            actionPerformed = true;
                            buildingBudget -= 100; // 升级到小城市花费100
                            console.log(`AI成功升级铁路连接城镇至小城市`);
                            continue;
                        }
                    }
                } catch (error) {
                    console.error("升级铁路连接城镇失败:", error);
                }
            }
        }
        
        // 交替尝试铁路和城镇建设，避免一直失败同一种操作
        const attemptRailway = attempt % 2 === 0 && railwayBudget >= 20;
        
        // 尝试建设铁路
        if (attemptRailway) {
            console.log("尝试建设铁路...");
            try {
                // 检查已有AI城镇数量，确认是否可以建设铁路
                let aiTownCount = 0;
                for (const region of aiRegions) {
                    if (region.towns) {
                        const aiTowns = region.towns.filter(town => {
                            const actualPlayer = aiFaction === "德军" ? "德军" : "协约国";
                            return town.owner === actualPlayer;
                        });
                        aiTownCount += aiTowns.length;
                    }
                }
                
                if (aiTownCount >= 2) {
                    const result = await aiTryBuildRailway(aiRegions, aiFaction);
                    if (result) {
                        actionsPerformed++;
                        actionPerformed = true;
                        railwayBudget -= 20;
                        console.log("AI成功建设铁路");
                        continue;
                    }
                } else {
                    console.log(`AI拥有的城镇数量不足(${aiTownCount})，无法建设铁路`);
                }
            } catch (error) {
                console.error("建设铁路失败:", error);
            }
        }
        
        // 如果铁路建设失败或不适合建设铁路，尝试建设/升级城镇
        if (buildingBudget >= 50 && !actionPerformed) {
            // 基于当前游戏阶段确定建设策略
            if (currentStage === "early") {
                // 早期阶段: 优先建设村落，特别是在冲突区域
                const conflictRegion = aiRegions.find(region => region.id === aiConflictRegion);
                
                if (conflictRegion && !window.aiFailedActions.buildVillage[aiConflictRegion]) {
                    console.log("尝试在冲突区域建设村落");
                    try {
                        const result = await aiTryBuildVillage([conflictRegion], aiFaction);
                        if (result) {
                            actionsPerformed++;
                            actionPerformed = true;
                            buildingBudget -= 50;
                            console.log("AI成功在冲突区域建设村落");
                            continue;
                        } else {
                            window.aiFailedActions.buildVillage[aiConflictRegion] = true;
                        }
                    } catch (error) {
                        console.error("在冲突区域建设村落失败:", error);
                        window.aiFailedActions.buildVillage[aiConflictRegion] = true;
                    }
                }
                
                // 如果冲突区域无法建设，在其他区域建设
                if (!actionPerformed && !window.aiFailedActions.buildVillage.other) {
                    console.log("尝试在其他区域建设村落");
                    try {
                        const result = await aiTryBuildVillage(aiRegions, aiFaction);
                        if (result) {
                            actionsPerformed++;
                            actionPerformed = true;
                            buildingBudget -= 50;
                            console.log("AI成功在其他区域建设村落");
                            continue;
                        } else {
                            window.aiFailedActions.buildVillage.other = true;
                        }
                    } catch (error) {
                        console.error("在其他区域建设村落失败:", error);
                        window.aiFailedActions.buildVillage.other = true;
                    }
                }
            } else {
                // 中期、后期和战争阶段: 更平衡的策略，考虑升级和扩展
                if (!actionPerformed) {
                    console.log("检查是否有铁路连接的城镇可以升级");
                    
                    // 首先检查是否有铁路连接的相邻城镇
                    let connectedTownsFound = false;
                    let upgradableTownRegion = null;
                    
                    for (const region of aiRegions) {
                        if (!region.towns || region.towns.length < 2 || !region.railways || region.railways.length === 0) {
                            continue; // 需要至少两个城镇和铁路才能进行检查
                        }
                        
                        // 获取AI控制的城镇
                        const aiTowns = region.towns.filter(town => {
                            const actualPlayer = aiFaction === "德军" ? "德军" : "协约国";
                            return town.owner === actualPlayer;
                        });
                        
                        if (aiTowns.length < 2) continue;
                        
                        // 检查每对城镇是否通过铁路连接
                        for (let i = 0; i < aiTowns.length; i++) {
                            for (let j = i + 1; j < aiTowns.length; j++) {
                                const town1 = aiTowns[i];
                                const town2 = aiTowns[j];
                                
                                // 检查这两个城镇之间是否有铁路连接
                                const hasRailway = region.railways.some(railway => 
                                    (railway.start.q === town1.coords.q && 
                                     railway.start.r === town1.coords.r && 
                                     railway.end.q === town2.coords.q && 
                                     railway.end.r === town2.coords.r) || 
                                    (railway.start.q === town2.coords.q && 
                                     railway.start.r === town2.coords.r && 
                                     railway.end.q === town1.coords.q && 
                                     railway.end.r === town1.coords.r)
                                );
                                
                                if (hasRailway) {
                                    console.log(`发现铁路连接的城镇: ${town1.name} 和 ${town2.name}`);
                                    connectedTownsFound = true;
                                    upgradableTownRegion = region;
                                    break;
                                }
                            }
                            if (connectedTownsFound) break;
                        }
                        
                        if (connectedTownsFound) break;
                    }
                    
                    // 如果找到了铁路连接的城镇，优先进行升级
                    if (connectedTownsFound && upgradableTownRegion) {
                        console.log("找到铁路连接的城镇，尝试升级城镇");
                        try {
                            // 先尝试升级为大城市（如果有足够GDP）
                            if (buildingBudget >= 200) {
                                const resultCity = await aiTryUpgradeTowns([upgradableTownRegion], aiFaction, 'city');
                                if (resultCity) {
                                    actionsPerformed++;
                                    actionPerformed = true;
                                    buildingBudget -= 200; // 升级到大城市花费200
                                    console.log(`AI成功升级铁路连接城镇至大城市`);
                                    continue;
                                }
                            }
                            
                            // 如果无法升级为大城市，尝试升级为小城市
                            if (!actionPerformed && buildingBudget >= 100) {
                                const result = await aiTryUpgradeTowns([upgradableTownRegion], aiFaction, 'town');
                                if (result) {
                                    actionsPerformed++;
                                    actionPerformed = true;
                                    buildingBudget -= 100; // 升级到小城市花费100
                                    console.log(`AI成功升级铁路连接城镇至小城市`);
                                    continue;
                                }
                            }
                        } catch (error) {
                            console.error("升级铁路连接城镇失败:", error);
                        }
                    }
                    
                    // 如果没有找到铁路连接的城镇或升级失败，继续常规升级逻辑
                    console.log("尝试常规升级城镇");
                    try {
                        // 先尝试升级村庄到小城市
                        const result = await aiTryUpgradeTowns(aiRegions, aiFaction, 'town');
                        if (result) {
                            actionsPerformed++;
                            actionPerformed = true;
                            buildingBudget -= 100; // 升级到小城市花费100
                            console.log(`AI成功升级城镇至小城市`);
                            continue;
                        }
                        
                        // 如果没有村庄可升级，尝试升级小城市到大城市
                        if (!actionPerformed && buildingBudget >= 200) {
                            const resultCity = await aiTryUpgradeTowns(aiRegions, aiFaction, 'city');
                            if (resultCity) {
                                actionsPerformed++;
                                actionPerformed = true;
                                buildingBudget -= 200; // 升级到大城市花费200
                                console.log(`AI成功升级城镇至大城市`);
                                continue;
                            }
                        }
                    } catch (error) {
                        console.error("升级城镇失败:", error);
                    }
                }
                
                // 在后期和战争阶段，优先考虑连接到冲突区域
                if (!actionPerformed && railwayBudget >= 20 && (currentStage === "late" || currentStage === "war")) {
                    console.log("尝试连接到冲突区域");
                    try {
                        // 确定AI对应的冲突区域
                        const conflictRegionId = aiFaction === "协约国" ? "FR-3" : "GE-3";
                        const result = await aiTryConnectToBorderRegions(aiRegions, aiFaction, [conflictRegionId]);
                        if (result) {
                            actionsPerformed++;
                            actionPerformed = true;
                            railwayBudget -= 20;
                            console.log("AI成功连接到冲突区域");
                            continue;
                        }
                    } catch (error) {
                        console.error("连接到冲突区域失败:", error);
                    }
                }
                
                // 如果升级失败，尝试建设新村落
                if (!actionPerformed) {
                    console.log("尝试建设新村落");
                    try {
                        const result = await aiTryBuildVillage(aiRegions, aiFaction);
                        if (result) {
                            actionsPerformed++;
                            actionPerformed = true;
                            buildingBudget -= 50;
                            console.log("AI成功建设新村落");
                            continue;
                        }
                    } catch (error) {
                        console.error("建设村落失败:", error);
                    }
                }
            }
        }
        
        // 如果本次尝试没有执行任何操作，可以考虑直接跳出循环
        if (!actionPerformed) {
            console.log("当前尝试未执行任何操作，减少剩余尝试次数");
        }
    }
    
    // 记录AI执行的操作总数
    console.log(`AI建设策略执行完毕，共执行了${actionsPerformed}个操作`);
    addLogEntry(`AI(${aiFaction})完成了建设回合，执行了${actionsPerformed}个操作`);
    
    return actionsPerformed > 0;
}

/**
 * AI尝试建设新村落
 * @returns {Promise<boolean>} 返回Promise，解析为建设成功与否
 */
async function aiTryBuildVillage(aiRegions, aiFaction) {
    console.log("AI尝试建设新村落...");
    
    // 获取当前游戏状态中实际的AI玩家名称
    let actualPlayer = aiFaction;  // 直接使用传入的AI阵营
    console.log(`AI阵营: ${aiFaction}, 实际使用的玩家名: ${actualPlayer}`);
    
    // 检查GDP是否足够
    let aiGDP = getCurrentAIGDP(aiFaction);
    if (aiGDP < 50) {
        console.log("AI GDP不足以建设村落（需要50）");
        return false;
    }
    
    // 随机选择一个区域建设城镇
    // 随机打乱区域顺序以避免总是在同一区域建设
    const shuffledRegions = [...aiRegions].sort(() => 0.5 - Math.random());
    
    // 跟踪已尝试过的失败位置
    if (!window.aiBuildAttempts) {
        window.aiBuildAttempts = new Set();
    }
    
    // 每50回合清除一次失败尝试记录，避免记录过多
    const currentRound = gameState.round || 1;
    if (currentRound % 10 === 0) {
        console.log("清除建设村落失败记录");
        window.aiBuildAttempts = new Set();
    }
    
    for (const region of shuffledRegions) {
        // 检查区域内是否有可用的位置建设城镇
        const occupiedPositions = [];
        
        // 收集所有已被占用的位置
        if (region.towns) {
            region.towns.forEach(town => {
                occupiedPositions.push(`${town.coords.q},${town.coords.r}`);
            });
        }
        
        // 找出所有空闲的位置
        const availableHexes = [];
        const edgeHexes = [];
        
        if (region.hex_tiles) {
            region.hex_tiles.forEach(hex => {
                const posKey = `${hex.q},${hex.r}`;
                if (!occupiedPositions.includes(posKey) && !window.aiBuildAttempts.has(`${region.id}-${posKey}`)) {
                    // 检查是否为边缘位置
                    const isEdge = isHexEdge(hex, region.hex_tiles);
                    if (isEdge) {
                        edgeHexes.push(hex);
                    } else {
                        availableHexes.push(hex);
                    }
                }
            });
        }
        
        // 优先使用非边缘位置，如果没有非边缘位置，再考虑边缘位置
        let candidateHexes = availableHexes.length > 0 ? availableHexes : edgeHexes;
        
        if (candidateHexes.length === 0) {
            console.log(`区域${region.id}没有未尝试过的可用位置建设城镇`);
            continue;
        }
        
        // 随机选择一个可用位置
        const selectedHex = candidateHexes[Math.floor(Math.random() * candidateHexes.length)];
        // 记录这次尝试，防止重复尝试失败的位置
        const positionKey = `${region.id}-${selectedHex.q},${selectedHex.r}`;
        window.aiBuildAttempts.add(positionKey);
        
        // 使用区域名称生成唯一城镇名称
        const baseName = region.name.includes('法国') ? '法' : '德';
        const randomNum = Math.floor(Math.random() * 100) + 1;
        const townName = `${baseName}${randomNum.toString().padStart(2, '0')}号城`;
        
        console.log(`AI准备在区域${region.id}的位置(${selectedHex.q},${selectedHex.r})建设城镇: ${townName}, 是边缘位置: ${availableHexes.length === 0}`);
        
        // 执行建设城镇操作
        try {
            const success = await new Promise((resolve) => {
                executeBuildTown(region.id, selectedHex, townName, actualPlayer, (success) => {
                    resolve(success);
                });
            });
            
            if (success) {
                addLogEntry(`AI(${aiFaction})在${region.name}建设了新城镇: ${townName}`);
                return true;
            } else {
                console.log(`AI在位置(${selectedHex.q},${selectedHex.r})建设城镇失败，将尝试其他位置`);
            }
        } catch (error) {
            console.error("建设村落时发生错误:", error);
        }
    }
    
    console.log("所有区域都没有可用位置建设城镇");
    return false;
}

/**
 * 判断一个六边形是否是边缘位置
 * @param {Object} hex 待检查的六边形
 * @param {Array} allHexes 该区域所有六边形
 * @returns {boolean} 是否为边缘位置
 */
function isHexEdge(hex, allHexes) {
    // 获取六个方向的邻居坐标
    const directions = [
        {q: 1, r: -1}, {q: 1, r: 0}, {q: 0, r: 1},
        {q: -1, r: 1}, {q: -1, r: 0}, {q: 0, r: -1}
    ];
    
    // 检查六个方向是否都有邻居
    let neighborCount = 0;
    for (const dir of directions) {
        const neighborQ = hex.q + dir.q;
        const neighborR = hex.r + dir.r;
        
        // 检查是否存在这个邻居
        const hasNeighbor = allHexes.some(h => h.q === neighborQ && h.r === neighborR);
        if (hasNeighbor) {
            neighborCount++;
        }
    }
    
    // 如果邻居数量少于6，则认为是边缘
    return neighborCount < 6;
}

/**
 * AI尝试升级城镇
 * @param {Array} aiRegions AI控制的区域
 * @param {string} aiFaction AI阵营
 * @param {string} targetType 目标类型：'town'升级为小城市，'city'升级为大城市
 * @returns {Promise<boolean>} 返回Promise，解析为升级成功与否
 */
async function aiTryUpgradeTowns(aiRegions, aiFaction, targetType) {
    console.log(`AI尝试升级城镇到${targetType}...`);
    
    // 获取当前游戏状态中实际的AI玩家名称
    let actualPlayer = aiFaction;  // 直接使用传入的AI阵营
    console.log(`AI阵营: ${aiFaction}, 实际使用的玩家名: ${actualPlayer}`);
    
    // 检查GDP是否足够
    let aiGDP = getCurrentAIGDP(aiFaction);
    const upgradeCost = targetType === 'town' ? 100 : 200; // 升级到小城市100，大城市200
    
    if (aiGDP < upgradeCost) {
        console.log(`AI GDP不足以升级城镇（需要${upgradeCost}）`);
        return false;
    }
    
    // 随机选择一个区域
    const shuffledRegions = [...aiRegions].sort(() => 0.5 - Math.random());
    
    // 跟踪已尝试过的失败升级
    if (!window.aiUpgradeAttempts) {
        window.aiUpgradeAttempts = new Set();
    }
    
    for (const region of shuffledRegions) {
        if (!region.towns || region.towns.length === 0) {
            continue;
        }
        
        // 获取可升级的城镇
        let upgradableTowns = [];
        
        if (targetType === 'town') {
            // 寻找可以升级为小城市的村落
            upgradableTowns = region.towns.filter(town => {
                console.log(`检查城镇: ${town.name}, 所有者: ${town.owner}, 类型: ${town.type}, 等级: ${town.level}, 建设中: ${town.is_under_construction}`);
                return town.owner === actualPlayer && 
                       (town.type === 'village' || !town.type) && 
                       !town.is_under_construction && 
                       !window.aiUpgradeAttempts.has(`${region.id}-${town.name}-town`);
            });
        } else if (targetType === 'city') {
            // 寻找可以升级为大城市的小城市
            upgradableTowns = region.towns.filter(town => {
                console.log(`检查城镇: ${town.name}, 所有者: ${town.owner}, 类型: ${town.type}, 等级: ${town.level}, 建设中: ${town.is_under_construction}`);
                return town.owner === actualPlayer && 
                       town.type === 'small_city' && 
                       !town.is_under_construction && 
                       !window.aiUpgradeAttempts.has(`${region.id}-${town.name}-city`);
            });
        }
        
        console.log(`区域 ${region.id} 中可升级的城镇数量: ${upgradableTowns.length}`);
        if (upgradableTowns.length === 0) {
            continue;
        }
        
        // 随机选择一个城镇升级
        const targetTown = upgradableTowns[Math.floor(Math.random() * upgradableTowns.length)];
        
        // 记录这次尝试
        const attemptKey = `${region.id}-${targetTown.name}-${targetType}`;
        window.aiUpgradeAttempts.add(attemptKey);
        
        console.log(`AI准备在区域${region.id}升级城镇"${targetTown.name}"为${targetType}`);
        
        try {
            // 直接发送请求到服务器，绕过前端逻辑
            const response = await fetch('/api/upgrade-town', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    region_id: region.id,
                    coords: targetTown.coords,
                    town_type: targetType,
                    player: actualPlayer
                })
            });
            
            if (!response.ok) {
                console.log(`AI升级城镇"${targetTown.name}"失败，HTTP状态: ${response.status}`);
                continue;
            }
            
            const result = await response.json();
            
            if (result.success) {
                console.log(`AI成功在${region.name}将城镇"${targetTown.name}"升级为${targetType}`);
                addLogEntry(`AI(${aiFaction})在${region.name}将城镇"${targetTown.name}"升级为${targetType === 'town' ? '小城市' : '大城市'}`);
                return true;
            } else {
                console.log(`AI升级城镇"${targetTown.name}"失败: ${result.message || '未知错误'}`);
            }
        } catch (error) {
            console.error("升级城镇时发生错误:", error);
        }
    }
    
    console.log(`没有找到可升级到${targetType}的城镇`);
    return false;
}

/**
 * AI尝试建设铁路
 * @param {Array} aiRegions AI控制的区域
 * @param {string} aiFaction AI阵营
 * @returns {Promise<boolean>} 返回Promise，解析为建设成功与否
 */
async function aiTryBuildRailway(aiRegions, aiFaction) {
    console.log("AI尝试建设铁路...");
    
    // 获取当前游戏状态中实际的AI玩家名称
    let actualPlayer = aiFaction;  // 直接使用传入的AI阵营
    console.log(`AI阵营: ${aiFaction}, 实际使用的玩家名: ${actualPlayer}`);
    
    // 检查GDP是否足够
    let aiGDP = getCurrentAIGDP(aiFaction);
    if (aiGDP < 20) {
        console.log("AI GDP不足以建设铁路（需要20）");
        return false;
    }
    
    // 随机选择一个区域
    const shuffledRegions = [...aiRegions].sort(() => 0.5 - Math.random());
    
    // 跟踪已尝试过的失败铁路建设
    if (!window.aiRailwayAttempts) {
        window.aiRailwayAttempts = new Set();
    }
    
    // 首先尝试在冲突区域及其周边建设铁路
    // 确定AI对应的冲突区域
    const conflictRegionId = aiFaction === "协约国" ? "FR-3" : "GE-3";
    const conflictRegion = aiRegions.find(region => region.id === conflictRegionId);
    
    if (conflictRegion) {
        console.log("尝试在冲突区域建设铁路");
        
        // 获取冲突区域内的AI城镇
        const conflictTowns = conflictRegion.towns?.filter(town => town.owner === actualPlayer) || [];
        
        if (conflictTowns.length > 0) {
            // 尝试在冲突区域内的可行位置建设铁路
            // 包括：1. 城镇之间 2. 城镇与边界格子之间 3. 任何两个相邻格子之间
            
            // 1. 首先尝试连接城镇与边界格子
            for (const town of conflictTowns) {
                // 获取城镇周围的相邻格子
                const neighbors = getNeighborCoords(town.coords.q, town.coords.r);
                
                // 随机排序相邻格子，优先考虑那些可能通向其他区域的格子
                const shuffledNeighbors = [...neighbors].sort(() => 0.5 - Math.random());
                
                for (const neighbor of shuffledNeighbors) {
                    // 检查是否已经有铁路连接
                    const hasRailway = conflictRegion.railways?.some(railway => 
                        (railway.start.q === town.coords.q && 
                         railway.start.r === town.coords.r && 
                         railway.end.q === neighbor.q && 
                         railway.end.r === neighbor.r) || 
                        (railway.start.q === neighbor.q && 
                         railway.start.r === neighbor.r && 
                         railway.end.q === town.coords.q && 
                         railway.end.r === town.coords.r)
                    );
                    
                    if (!hasRailway) {
                        const pairKey = `${conflictRegion.id}-${town.coords.q},${town.coords.r}-${neighbor.q},${neighbor.r}`;
                        
                        if (!window.aiRailwayAttempts.has(pairKey)) {
                            // 记录这次尝试
                            window.aiRailwayAttempts.add(pairKey);
                            
                            console.log(`AI准备在冲突区域建设从城镇(${town.coords.q},${town.coords.r})到相邻格子(${neighbor.q},${neighbor.r})的铁路`);
                            
                            try {
                                // 执行铁路建设
                                const success = await new Promise((resolve) => {
                                    executeBuildRailway(conflictRegion.id, town.coords, neighbor, actualPlayer, (success) => {
                                        resolve(success);
                                    });
                                });
                                
                                if (success) {
                                    addLogEntry(`AI(${aiFaction})在冲突区域${conflictRegion.name}建设了新铁路`);
                                    return true;
                                }
                            } catch (error) {
                                console.error("在冲突区域建设铁路时发生错误:", error);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 如果冲突区域建设失败，尝试在其他区域建设
    for (const region of shuffledRegions) {
        // 检查区域内是否有AI控制的城镇
        if (!region.towns || region.towns.length === 0) {
            continue;
        }
        
        const aiTowns = region.towns.filter(town => town.owner === actualPlayer);
        
        if (aiTowns.length > 0) {
            // 尝试两种策略：
            // 1. 连接现有城镇（传统方法）
            if (aiTowns.length >= 2) {
                for (let i = 0; i < aiTowns.length; i++) {
                    for (let j = i + 1; j < aiTowns.length; j++) {
                        // 检查这两个城镇之间是否已经有铁路
                        const hasRailway = region.railways?.some(railway => 
                            (railway.start.q === aiTowns[i].coords.q && 
                             railway.start.r === aiTowns[i].coords.r && 
                             railway.end.q === aiTowns[j].coords.q && 
                             railway.end.r === aiTowns[j].coords.r) || 
                            (railway.start.q === aiTowns[j].coords.q && 
                             railway.start.r === aiTowns[j].coords.r && 
                             railway.end.q === aiTowns[i].coords.q && 
                             railway.end.r === aiTowns[i].coords.r)
                        );
                        
                        if (!hasRailway && areHexesAdjacent(aiTowns[i].coords.q, aiTowns[i].coords.r, aiTowns[j].coords.q, aiTowns[j].coords.r)) {
                            const pairKey = `${region.id}-${aiTowns[i].coords.q},${aiTowns[i].coords.r}-${aiTowns[j].coords.q},${aiTowns[j].coords.r}`;
                            
                            if (!window.aiRailwayAttempts.has(pairKey)) {
                                window.aiRailwayAttempts.add(pairKey);
                                
                                console.log(`AI准备在区域${region.id}建设从城镇(${aiTowns[i].coords.q},${aiTowns[i].coords.r})到城镇(${aiTowns[j].coords.q},${aiTowns[j].coords.r})的铁路`);
                                
                                try {
                                    const success = await new Promise((resolve) => {
                                        executeBuildRailway(region.id, aiTowns[i].coords, aiTowns[j].coords, actualPlayer, (success) => {
                                            resolve(success);
                                        });
                                    });
                                    
                                    if (success) {
                                        addLogEntry(`AI(${aiFaction})在${region.name}建设了城镇间的新铁路`);
                                        return true;
                                    }
                                } catch (error) {
                                    console.error("建设城镇间铁路时发生错误:", error);
                                }
                            }
                        }
                    }
                }
            }
            
            // 2. 从现有城镇向外拓展（新方法）
            for (const town of aiTowns) {
                // 获取城镇周围的相邻格子
                const neighbors = getNeighborCoords(town.coords.q, town.coords.r);
                
                // 随机排序相邻格子
                const shuffledNeighbors = [...neighbors].sort(() => 0.5 - Math.random());
                
                for (const neighbor of shuffledNeighbors) {
                    // 检查是否已经有铁路连接
                    const hasRailway = region.railways?.some(railway => 
                        (railway.start.q === town.coords.q && 
                         railway.start.r === town.coords.r && 
                         railway.end.q === neighbor.q && 
                         railway.end.r === neighbor.r) || 
                        (railway.start.q === neighbor.q && 
                         railway.start.r === neighbor.r && 
                         railway.end.q === town.coords.q && 
                         railway.end.r === town.coords.r)
                    );
                    
                    if (!hasRailway) {
                        const pairKey = `${region.id}-${town.coords.q},${town.coords.r}-${neighbor.q},${neighbor.r}`;
                        
                        if (!window.aiRailwayAttempts.has(pairKey)) {
                            window.aiRailwayAttempts.add(pairKey);
                            
                            console.log(`AI准备在区域${region.id}建设从城镇(${town.coords.q},${town.coords.r})到相邻格子(${neighbor.q},${neighbor.r})的铁路`);
                            
                            try {
                                const success = await new Promise((resolve) => {
                                    executeBuildRailway(region.id, town.coords, neighbor, actualPlayer, (success) => {
                                        resolve(success);
                                    });
                                });
                                
                                if (success) {
                                    addLogEntry(`AI(${aiFaction})在${region.name}建设了城镇向外拓展的新铁路`);
                                    return true;
                                }
                            } catch (error) {
                                console.error("建设城镇向外拓展铁路时发生错误:", error);
                            }
                        }
                    }
                }
            }
            
            // 3. 尝试在区域内随机建设铁路（如果前两种方法都失败）
            // 这里可以添加更复杂的逻辑，例如找出现有铁路网络的边缘节点，然后向外扩展
        }
    }
    
    console.log("所有区域都没有合适的位置建设铁路");
    return false;
}

/**
 * AI尝试连接到边界区域的铁路
 * @param {Array} aiRegions AI控制的区域
 * @param {string} aiFaction AI阵营
 * @param {Array} borderRegionIds 边界区域ID列表
 * @returns {Promise<boolean>} 返回Promise，解析为建设成功与否
 */
async function aiTryConnectToBorderRegions(aiRegions, aiFaction, borderRegionIds) {
    console.log(`AI尝试连接到边界区域: ${borderRegionIds.join(', ')}...`);
    
    // 获取当前游戏状态中实际的AI玩家名称
    let actualPlayer = aiFaction;  // 直接使用传入的AI阵营
    console.log(`AI阵营: ${aiFaction}, 实际使用的玩家名: ${actualPlayer}`);
    
    // 检查GDP是否足够
    let aiGDP = getCurrentAIGDP(aiFaction);
    if (aiGDP < 20) {
        console.log("AI GDP不足以建设铁路（需要20）");
        return false;
    }
    
    // 找出冲突区域
    const conflictRegions = aiRegions.filter(region => borderRegionIds.includes(region.id));
    if (conflictRegions.length === 0) {
        console.log("没有找到指定的冲突区域");
        return false;
    }
    
    // 首先，尝试在冲突区域内建设铁路，连接该区域内的所有城镇
    for (const conflictRegion of conflictRegions) {
        // 检查冲突区域内是否有AI控制的城镇
        if (!conflictRegion.towns || conflictRegion.towns.length < 2) {
            console.log(`冲突区域${conflictRegion.id}没有足够的AI城镇进行铁路连接`);
            continue;
        }
        
        const conflictTowns = conflictRegion.towns.filter(town => town.owner === actualPlayer);
        if (conflictTowns.length < 2) {
            console.log(`冲突区域${conflictRegion.id}没有足够的AI控制的城镇`);
            continue;
        }
        
        // 尝试在冲突区域内建设铁路，连接所有城镇
        for (let i = 0; i < conflictTowns.length; i++) {
            for (let j = i + 1; j < conflictTowns.length; j++) {
                const town1 = conflictTowns[i];
                const town2 = conflictTowns[j];
                
                // 检查这两个城镇之间是否已经有铁路
                const hasRailway = conflictRegion.railways?.some(railway => 
                    (railway.start.q === town1.coords.q && 
                     railway.start.r === town1.coords.r && 
                     railway.end.q === town2.coords.q && 
                     railway.end.r === town2.coords.r) || 
                    (railway.start.q === town2.coords.q && 
                     railway.start.r === town2.coords.r && 
                     railway.end.q === town1.coords.q && 
                     railway.end.r === town1.coords.r)
                );
                
                if (!hasRailway && areHexesAdjacent(town1.coords.q, town1.coords.r, town2.coords.q, town2.coords.r)) {
                    // 如果两个城镇相邻且没有铁路连接，尝试建设铁路
                    const pairKey = `${conflictRegion.id}-${town1.coords.q},${town1.coords.r}-${town2.coords.q},${town2.coords.r}`;
                    
                    // 检查是否已经尝试过失败
                    if (!window.aiRailwayAttempts?.has(pairKey)) {
                        try {
                            // 跟踪已尝试过的失败铁路建设
                            if (!window.aiRailwayAttempts) {
                                window.aiRailwayAttempts = new Set();
                            }
                            window.aiRailwayAttempts.add(pairKey);
                            
                            console.log(`AI准备在冲突区域${conflictRegion.id}内建设铁路，连接两个城镇`);
                            
                            const success = await new Promise((resolve) => {
                                executeBuildRailway(conflictRegion.id, town1.coords, town2.coords, actualPlayer, (success) => {
                                    resolve(success);
                                });
                            });
                            
                            if (success) {
                                addLogEntry(`AI(${aiFaction})在冲突区域${conflictRegion.name}内建设了铁路，连接两个城镇`);
                                return true;
                            }
                        } catch (error) {
                            console.error("建设冲突区域内铁路时发生错误:", error);
                        }
                    }
                }
            }
        }
    }
    
    // 如果冲突区域内铁路已经完善，尝试建设连接冲突区域的铁路
    // 寻找离冲突区域最近的非冲突区域的城镇
    const nonConflictRegions = aiRegions.filter(region => !borderRegionIds.includes(region.id));
    
    // 依次尝试从每个非冲突区域建设铁路到冲突区域
    for (const nonConflictRegion of nonConflictRegions) {
        if (!nonConflictRegion.towns || nonConflictRegion.towns.length === 0) {
            continue;
        }
        
        const nonConflictTowns = nonConflictRegion.towns.filter(town => town.owner === actualPlayer);
        if (nonConflictTowns.length === 0) {
            continue;
        }
        
        // 对于每个冲突区域
        for (const conflictRegion of conflictRegions) {
            if (!conflictRegion.towns || conflictRegion.towns.length === 0) {
                continue;
            }
            
            const conflictTowns = conflictRegion.towns.filter(town => town.owner === actualPlayer);
            if (conflictTowns.length === 0) {
                continue;
            }
            
            // 尝试从非冲突区域到冲突区域建设铁路
            for (const nonConflictTown of nonConflictTowns) {
                for (const conflictTown of conflictTowns) {
                    // 如果不是相邻区域，跳过
                    if (nonConflictRegion.id[0] !== conflictRegion.id[0]) {
                        continue;
                    }
                    
                    // 检查两个城镇是否位于相邻格子（可跨区域）
                    if (areHexesAdjacent(nonConflictTown.coords.q, nonConflictTown.coords.r, conflictTown.coords.q, conflictTown.coords.r)) {
                        const pairKey = `${nonConflictRegion.id}-${nonConflictTown.coords.q},${nonConflictTown.coords.r}-${conflictRegion.id}-${conflictTown.coords.q},${conflictTown.coords.r}`;
                        
                        // 检查是否已经尝试过失败
                        if (!window.aiRailwayAttempts?.has(pairKey)) {
                            try {
                                // 跟踪已尝试过的失败铁路建设
                                if (!window.aiRailwayAttempts) {
                                    window.aiRailwayAttempts = new Set();
                                }
                                window.aiRailwayAttempts.add(pairKey);
                                
                                console.log(`AI准备建设从${nonConflictRegion.id}到冲突区域${conflictRegion.id}的铁路`);
                                
                                // 尝试在相应区域内建设铁路
                                // 注意：这里假设城镇所在的格子位于同一区域，如果是跨区域，需要确定正确的区域ID
                                const regionId = areInSameRegion(nonConflictTown, conflictTown) ? 
                                    nonConflictRegion.id : getBestRegionForRailway(nonConflictTown, conflictTown);
                                
                                if (regionId) {
                                    const success = await new Promise((resolve) => {
                                        executeBuildRailway(regionId, nonConflictTown.coords, conflictTown.coords, actualPlayer, (success) => {
                                            resolve(success);
                                        });
                                    });
                                    
                                    if (success) {
                                        addLogEntry(`AI(${aiFaction})建设了从${nonConflictRegion.name}到冲突区域${conflictRegion.name}的铁路`);
                                        return true;
                                    }
                                }
                            } catch (error) {
                                console.error("建设跨区域铁路时发生错误:", error);
                            }
                        }
                    }
                }
            }
        }
    }
    
    // 如果仍然没有建设铁路，尝试在最靠近冲突区域的地方建设
    console.log("尝试在最靠近冲突区域的地方建设铁路");
    for (const region of aiRegions) {
        if (!region.towns || region.towns.length < 2) {
            continue;
        }
        
        const aiTowns = region.towns.filter(town => town.owner === actualPlayer);
        if (aiTowns.length < 2) {
            continue;
        }
        
        // 随机选择两个城镇，优先选择没有连接的相邻城镇
        for (let i = 0; i < aiTowns.length; i++) {
            for (let j = i + 1; j < aiTowns.length; j++) {
                const town1 = aiTowns[i];
                const town2 = aiTowns[j];
                
                if (!areHexesAdjacent(town1.coords.q, town1.coords.r, town2.coords.q, town2.coords.r)) {
                    continue;
                }
                
                // 检查这两个城镇之间是否已经有铁路
                const hasRailway = region.railways?.some(railway => 
                    (railway.start.q === town1.coords.q && 
                     railway.start.r === town1.coords.r && 
                     railway.end.q === town2.coords.q && 
                     railway.end.r === town2.coords.r) || 
                    (railway.start.q === town2.coords.q && 
                     railway.start.r === town2.coords.r && 
                     railway.end.q === town1.coords.q && 
                     railway.end.r === town1.coords.r)
                );
                
                if (!hasRailway) {
                    const pairKey = `${region.id}-${town1.coords.q},${town1.coords.r}-${town2.coords.q},${town2.coords.r}`;
                    
                    // 检查是否已经尝试过失败
                    if (!window.aiRailwayAttempts?.has(pairKey)) {
                        try {
                            // 跟踪已尝试过的失败铁路建设
                            if (!window.aiRailwayAttempts) {
                                window.aiRailwayAttempts = new Set();
                            }
                            window.aiRailwayAttempts.add(pairKey);
                            
                            console.log(`AI准备在区域${region.id}建设新铁路，为通往冲突区域做准备`);
                            
                            const success = await new Promise((resolve) => {
                                executeBuildRailway(region.id, town1.coords, town2.coords, actualPlayer, (success) => {
                                    resolve(success);
                                });
                            });
                            
                            if (success) {
                                addLogEntry(`AI(${aiFaction})在${region.name}建设了新铁路，为连接冲突区域做准备`);
                                return true;
                            }
                        } catch (error) {
                            console.error("建设准备性铁路时发生错误:", error);
                        }
                    }
                }
            }
        }
    }
    
    console.log("无法建立到冲突区域的铁路连接");
    return false;
}

// 辅助函数：检查两个城镇是否在同一区域
function areInSameRegion(town1, town2) {
    return town1.regionId === town2.regionId;
}

// 辅助函数：确定建设铁路的最佳区域
function getBestRegionForRailway(town1, town2) {
    // 简单实现：返回第一个城镇的区域
    return town1.regionId || null;
}

// 添加在文件末尾
/**
 * 获取AI当前拥有的GDP
 * @param {string} aiFaction - AI的阵营
 * @return {number} AI当前拥有的GDP
 */
function getCurrentAIGDP(aiFaction) {
    console.log(`获取AI(${aiFaction})的当前GDP`);
    
    if (!gameState || !gameState.players) {
        console.warn('游戏状态或玩家信息不存在');
        return 0;
    }
    
    // 查找AI的GDP
    for (const [key, player] of Object.entries(gameState.players)) {
        if (key === aiFaction) {
            console.log(`找到AI(${aiFaction})的GDP: ${player.gdp || 0}`);
            return player.gdp || 0;
        }
    }
    
    console.warn(`未找到AI(${aiFaction})的GDP数据`);
    return 0;
}

/**
 * 执行AI建设铁路操作
 * @param {string} regionId 区域ID
 * @param {Object} startCoords 起点坐标 {q, r}
 * @param {Object} endCoords 终点坐标 {q, r}
 * @param {string} playerFaction 玩家阵营
 * @param {Function} callback 回调函数，接受一个布尔参数表示成功与否
 */
function executeBuildRailway(regionId, startCoords, endCoords, playerFaction, callback) {
    console.log(`执行AI建设铁路：区域=${regionId}, 起点=(${startCoords.q},${startCoords.r}), 终点=(${endCoords.q},${endCoords.r}), 玩家=${playerFaction}`);
    
    // 检查铁路起点和终点是否相邻
    if (!areHexesAdjacent(startCoords.q, startCoords.r, endCoords.q, endCoords.r)) {
        console.error("铁路起点和终点必须相邻");
        if (callback) callback(false);
        return;
    }
    
    // 先检查玩家的GDP是否足够
    // 获取玩家当前GDP
    let playerGDP = 0;
    if (gameState && gameState.players && playerFaction) {
        const player = gameState.players[playerFaction];
        if (player) {
            playerGDP = player.gdp || 0;
        }
    }
    
    // 如果GDP不足20，无法建设铁路
    if (playerGDP < 20) {
        console.error(`AI铁路建设失败：GDP不足 (当前: ${playerGDP}, 需要: 20)`);
        if (callback) callback(false);
        return;
    }
    
    // 调用现有的铁路建设函数
    buildRailway(regionId, startCoords, endCoords, playerFaction)
        .then(success => {
            if (success) {
                console.log("AI铁路建设成功");
                if (callback) callback(true);
            } else {
                console.log("AI铁路建设失败");
                if (callback) callback(false);
            }
        })
        .catch(error => {
            console.error("AI铁路建设错误:", error);
            if (callback) callback(false);
        });
}

/**
 * 执行AI宣战操作
 * @param {string} aiFaction AI阵营
 * @returns {Promise<boolean>} 是否成功宣战
 */
async function executeDeclareWar(aiFaction) {
    console.log(`执行AI宣战：阵营=${aiFaction}`);
    
    try {
        // 调用游戏的宣战函数
        return new Promise((resolve) => {
            declareWar()
                .then(success => {
                    if (success) {
                        console.log(`AI(${aiFaction})成功宣战`);
                        resolve(true);
                    } else {
                        console.log(`AI(${aiFaction})宣战失败`);
                        resolve(false);
                    }
                })
                .catch(error => {
                    console.error("宣战时发生错误:", error);
                    resolve(false);
                });
        });
    } catch (error) {
        console.error("执行宣战函数时发生错误:", error);
        return false;
    }
}

/**
 * 执行AI动员军队操作
 * @param {string} regionId 区域ID
 * @param {string} aiFaction AI阵营
 * @param {number} budget 动员预算
 * @returns {Promise<boolean>} 是否成功动员
 */
async function executeMobilizeTroops(regionId, aiFaction, budget) {
    console.log(`执行AI动员军队：区域=${regionId}, 阵营=${aiFaction}, 预算=${budget}`);
    
    // 获取区域对象
    const region = gameState.regions.find(r => r.id === regionId);
    if (!region) {
        console.error(`找不到区域: ${regionId}`);
        return false;
    }
    
    // 获取当前游戏状态中实际的AI玩家名称
    let actualPlayer = '协约国';
    if (gameState && gameState.players) {
        for (const [key, player] of Object.entries(gameState.players)) {
            if (key === '协约国' || key === '法军') {
                actualPlayer = key;
                break;
            }
        }
    }
    
    // 获取AI控制的城镇
    if (!region.towns || region.towns.length === 0) {
        console.error(`区域${regionId}没有城镇`);
        return false;
    }
    
    const aiTowns = region.towns.filter(town => town.owner === actualPlayer);
    if (aiTowns.length === 0) {
        console.error(`区域${regionId}没有AI控制的城镇`);
        return false;
    }
    
    // 选择最大的城镇进行动员
    // 优先选择大城市 > 小城市 > 村庄
    let targetTown = aiTowns.find(town => town.type === 'city') || 
                    aiTowns.find(town => town.type === 'town') || 
                    aiTowns[0];
    
    console.log(`选择在城镇"${targetTown.name}"动员军队，类型: ${targetTown.type || '村庄'}`);
    
    // 计算可动员的部队数量（根据预算和成本）
    // 假设每个部队需要10单位GDP
    const troopCost = 10;
    const troopCount = Math.floor(budget / troopCost);
    
    if (troopCount <= 0) {
        console.log(`预算${budget}不足以动员任何部队（每个部队成本${troopCost}）`);
        return false;
    }
    
    console.log(`准备动员${troopCount}个部队（总成本: ${troopCount * troopCost}）`);
    
    try {
        // 调用游戏的动员部队函数
        return new Promise((resolve) => {
            mobilizeTroops(region.id, targetTown.name, troopCount)
                .then(success => {
                    if (success) {
                        console.log(`成功在${region.name}的"${targetTown.name}"动员了${troopCount}个部队`);
                        resolve(true);
                    } else {
                        console.log(`在${region.name}的"${targetTown.name}"动员部队失败`);
                        resolve(false);
                    }
                })
                .catch(error => {
                    console.error("动员部队时发生错误:", error);
                    resolve(false);
                });
        });
    } catch (error) {
        console.error("执行动员函数时发生错误:", error);
        return false;
    }
}

/**
 * 计算AI的军事实力
 * @param {string} aiFaction AI阵营
 * @returns {number} 军事实力值
 */
function calculateAIMilitaryStrength(aiFaction) {
    let strength = 0;
    
    // 获取当前游戏状态中实际的AI玩家名称
    let actualPlayer = '协约国';
    if (gameState && gameState.players) {
        for (const [key, player] of Object.entries(gameState.players)) {
            if (key === '协约国' || key === '法军') {
                actualPlayer = key;
                break;
            }
        }
    }
    
    // 遍历所有区域计算军事实力
    for (const region of gameState.regions) {
        if (region.towns) {
            for (const town of region.towns) {
                if (town.owner === actualPlayer && town.troops) {
                    strength += town.troops; // 加上城镇的部队数量
                }
            }
        }
    }
    
    return strength;
}

/**
 * AI战争策略
 * 基于游戏回合和当前战略阶段，决定是否宣战
 */
async function aiWarStrategy() {
    console.log("AI执行战争策略...");
    
    // 使用标准玩家名称确定AI阵营
    const playerStandard = window.standardPlayerName || "德军";
    const aiFaction = playerStandard === "德军" ? "协约国" : "德军";
    
    console.log("玩家标准阵营:", playerStandard, "AI标准阵营:", aiFaction);
    
    // 确定AI对应的冲突区域
    const aiConflictRegion = aiFaction === "协约国" ? "FR-3" : "GE-3";
    console.log("AI方冲突区域:", aiConflictRegion);
    
    // 获取当前回合数，确定战略阶段
    const currentRound = gameState.round || 1;
    let currentStage = "";
    
    // 根据回合数确定当前策略阶段
    if (currentRound <= 10) {
        currentStage = "early"; // 早期发展 (1-10回合)
    } else if (currentRound <= 20) {
        currentStage = "mid"; // 中期扩张 (11-20回合)
    } else if (currentRound <= 30) {
        currentStage = "late"; // 后期战备 (21-30回合)
    } else {
        currentStage = "war"; // 战争阶段 (31-40回合)
    }
    
    console.log(`当前回合: ${currentRound}, 策略阶段: ${currentStage}`);
    
    // 检查是否存在冲突区域
    let conflictExists = false;
    let conflictRegion = null;
    
    for (const region of gameState.regions) {
        if (region.id === aiConflictRegion && region.conflict) {
            conflictExists = true;
            conflictRegion = region;
            break;
        }
    }
    
    // 根据当前阶段决定战争策略
    let shouldDeclareWar = false;
    
    // 获取AI的军事实力（假设为拥有的部队数量）
    const aiMilitaryStrength = calculateAIMilitaryStrength(aiFaction);
    console.log(`AI军事实力: ${aiMilitaryStrength}`);
    
    // 获取AI的经济实力（当前GDP）
    const aiEconomicStrength = getCurrentAIGDP(aiFaction);
    console.log(`AI经济实力: ${aiEconomicStrength}`);
    
    // 战争宣言概率基于当前阶段
    let warDeclarationProbability = 0;
    
    if (currentStage === "early") {
        // 早期（回合1-10）不宣战
        warDeclarationProbability = 0;
    } else if (currentStage === "mid") {
        // 中期（回合11-20）不宣战
        warDeclarationProbability = 0;
    } else if (currentStage === "late") {
        // 后期（回合21-30）不宣战（保护期）
        warDeclarationProbability = 0;
    } else { // 战争阶段（回合31-40）
        // 战争阶段有较高概率宣战，随着回合增加概率增加
        warDeclarationProbability = 0.2 + ((currentRound - 30) * 0.05);
        // 限制最大概率为0.7
        warDeclarationProbability = Math.min(warDeclarationProbability, 0.7);
    }
    
    // AI难度会影响宣战概率
    if (window.aiDifficulty === 'easy') {
        warDeclarationProbability *= 0.5; // 简单难度减半
    } else if (window.aiDifficulty === 'hard') {
        warDeclarationProbability *= 1.5; // 困难难度增加50%
    }
    
    console.log(`宣战基础概率: ${warDeclarationProbability}`);
    
    // 如果已经存在冲突，增援而不是宣战
    if (conflictExists) {
        console.log("已有冲突存在，AI将增援冲突而不宣战");
        // TODO: 实现增援逻辑
        addLogEntry(`AI(${aiFaction})正在增援${conflictRegion.name}的冲突`);
        return true;
    }
    
    // 根据概率决定是否宣战
    const randomValue = Math.random();
    shouldDeclareWar = randomValue < warDeclarationProbability;
    
    console.log(`随机值: ${randomValue}, 宣战决定: ${shouldDeclareWar}`);
    
    if (shouldDeclareWar) {
        // 执行宣战
        try {
            const success = await executeDeclareWar(aiFaction);
            
            if (success) {
                addLogEntry(`AI(${aiFaction})宣布对玩家(${playerStandard})发动战争！`);
                return true;
            } else {
                console.log("AI宣战失败");
                return false;
            }
        } catch (error) {
            console.error("AI宣战过程中发生错误:", error);
            return false;
        }
    } else {
        console.log("AI选择不宣战");
        return false;
    }
}

/**
 * 执行AI建造城镇操作
 * @param {string} regionId 区域ID
 * @param {Object} coords 城镇坐标 {q, r, s}
 * @param {string} townName 城镇名称
 * @param {string} playerFaction 玩家阵营
 * @param {function} callback 回调函数，接受一个布尔参数表示成功与否
 */
function executeBuildTown(regionId, coords, townName, playerFaction, callback) {
    console.log(`执行AI建造城镇: ${townName} at (${coords.q},${coords.r}) in ${regionId} for faction ${playerFaction}`);
    
    try {
        // 调用现有的buildTown函数执行建造操作，传入isAI=true和playerFaction
        buildTown(regionId, coords, townName, true, playerFaction)
            .then(result => {
                if (result && result.success) {
                    console.log(`AI成功建造城镇: ${townName}`);
                    if (callback) callback(true);
                } else {
                    console.log(`AI建造城镇失败: ${result ? result.error : '未知错误'}`);
                    if (callback) callback(false);
                }
            })
            .catch(error => {
                console.error("执行建造城镇时出错:", error);
                if (callback) callback(false);
            });
    } catch (error) {
        console.error("执行建造城镇时出错:", error);
        if (callback) callback(false);
    }
}

function checkAndShowRandomEvent(round) {
    if (round === 5 && !eventShown) {
        eventShown = true;
        showEventModal();
    }
}

function showEventModal() {
    // 创建遮罩层
    let modal = document.createElement('div');
    modal.style.position = 'fixed';
    modal.style.top = 0;
    modal.style.left = 0;
    modal.style.width = '100vw';
    modal.style.height = '100vh';
    modal.style.background = 'rgba(0,0,0,0.7)';
    modal.style.display = 'flex';
    modal.style.justifyContent = 'center';
    modal.style.alignItems = 'center';
    modal.style.zIndex = 9999;

    // 图片
    let img = document.createElement('img');
    img.src = '/static/images/rougelike.png';
    img.style.maxWidth = '80vw';
    img.style.maxHeight = '80vh';
    img.style.borderRadius = '16px';
    img.style.boxShadow = '0 0 32px #000';
    modal.appendChild(img);

    // 点击关闭
    modal.addEventListener('click', function() {
        document.body.removeChild(modal);
    });

    document.body.appendChild(modal);
}

/**
 * 显示快速结算模态框
 */
function showQuickSettlementModal() {
    // 创建模态框内容，显示结果图片
    const modalContent = `
        <div class="settlement-result" style="text-align: center;">
            <img src="/static/images/result.png" alt="结算结果" style="width: 100%; max-width: 800px;">
        </div>
    `;
    
    // 显示模态框，第三个参数为null表示不需要确认回调
    showModal('德军 胜利!', modalContent, null);
    
    // 添加游戏日志
    addLogEntry('快速结算：德军胜利！');
    
    // 确保关闭按钮可见
    const closeModalBtn = document.querySelector('.close-modal');
    if (closeModalBtn) {
        closeModalBtn.style.display = 'block';
    }
}