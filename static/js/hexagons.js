/**
 * 六角格地图渲染模块
 */

class HexGrid {
    /**
     * 创建六角格地图
     * @param {string} containerId 地图容器ID
     * @param {number} radius 地图半径
     */
    constructor(containerId, radius = 22) {
        this.containerId = containerId;
        this.radius = radius;
        this.container = null; // 将在_createSvgContainer中初始化
        this.hexSize = 30; // 修改六边形大小，从20改为30，使六边形更大
        this.hexagons = {}; // 存储所有六边形
        this.selectedHex = null; // 当前选中的六边形
        this.railways = []; // 铁路连接
        this.regions = {}; // 区域
        this.onHexClick = null; // 点击回调
        this.lastClickedCoords = null; // 最后点击的坐标
        this.lastClickTime = null; // 用于防止快速重复点击
        this.eventsBound = false; // 是否已绑定事件
        
        // 创建特定的图案ID，避免冲突
        this.grassPatternId = `grass-pattern-${Date.now()}`;
    }

    /**
     * 初始化地图
     */
    init() {
        this._createSvgContainer();
        this._createHexGrid();
        this._createExampleHighlight(); // 添加示例高亮区域
    }

    /**
     * 创建SVG容器
     * @private
     */
    _createSvgContainer() {
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            console.error(`找不到ID为 ${this.containerId} 的容器元素`);
            return;
        }
        
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        
        // 计算更适合的视图范围 - 减小视图框大小以增大缩放比例
        const viewBoxSize = Math.max(width, height) * 0.8; // 从1.5改为0.8使默认缩放更大
        
        // 创建SVG容器
        this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        this.svg.setAttribute("width", "100%");
        this.svg.setAttribute("height", "100%");
        // 调整viewBox的初始位置，向右上方移动视图以便地图居中显示
        // 原来是(-viewBoxSize/2, -viewBoxSize/2)，现在向右移动100，向上移动50
        this.svg.setAttribute("viewBox", `${-viewBoxSize/2 + 150} ${-viewBoxSize/2 + 200} ${viewBoxSize} ${viewBoxSize}`);
        this.svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
        
        // 定义草坪图案
        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
        pattern.setAttribute("id", this.grassPatternId);
        pattern.setAttribute("patternUnits", "userSpaceOnUse");
        pattern.setAttribute("width", "50");
        pattern.setAttribute("height", "50");
        
        const image = document.createElementNS("http://www.w3.org/2000/svg", "image");
        image.setAttribute("href", "/static/images/草坪.png");
        image.setAttribute("x", "0");
        image.setAttribute("y", "0");
        image.setAttribute("width", "50");
        image.setAttribute("height", "50");
        
        pattern.appendChild(image);
        defs.appendChild(pattern);
        this.svg.appendChild(defs);
        
        // 添加缩放和平移功能
        this.svg.style.cursor = "grab";
        
        // 如果已经绑定过事件，不再重复绑定
        if (!this.eventsBound) {
            let dragging = false;
            let startX, startY;
            // 初始化viewBox，确保与上面设置的值一致
            let viewBox = { 
                x: -viewBoxSize/2 + 100, 
                y: -viewBoxSize/2 - 50, 
                width: viewBoxSize, 
                height: viewBoxSize 
            };
            
            this.svg.addEventListener('mousedown', (e) => {
                // 只有点击到空白区域才触发拖动
                if (e.target === this.svg || e.target === this.gameLayer) {
                    dragging = true;
                    startX = e.clientX;
                    startY = e.clientY;
                    this.svg.style.cursor = "grabbing";
                    e.preventDefault();
                }
            });
            
            document.addEventListener('mousemove', (e) => {
                if (!dragging) return;
                
                const dx = (e.clientX - startX) * viewBox.width / width;
                const dy = (e.clientY - startY) * viewBox.height / height;
                
                viewBox.x -= dx;
                viewBox.y -= dy;
                
                this.svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
                
                startX = e.clientX;
                startY = e.clientY;
            });
            
            document.addEventListener('mouseup', () => {
                dragging = false;
                this.svg.style.cursor = "grab";
            });
            
            // 添加滚轮缩放
            this.svg.addEventListener('wheel', (e) => {
                e.preventDefault();
                
                const scaleFactor = e.deltaY > 0 ? 1.1 : 0.9;
                
                // 计算鼠标位置作为缩放中心
                const rect = this.svg.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // 计算相对于SVG视图框的位置
                const svgX = viewBox.x + (mouseX / width) * viewBox.width;
                const svgY = viewBox.y + (mouseY / height) * viewBox.height;
                
                // 应用缩放
                viewBox.width *= scaleFactor;
                viewBox.height *= scaleFactor;
                
                // 调整原点以保持鼠标位置不变
                viewBox.x = svgX - (mouseX / width) * viewBox.width;
                viewBox.y = svgY - (mouseY / height) * viewBox.height;
                
                this.svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`);
            });
            
            this.eventsBound = true;
        }
        
        // 创建图层
        this.gameLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.gameLayer.setAttribute("class", "game-layer");
        
        this.backgroundLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.backgroundLayer.setAttribute("class", "background-layer");
        
        this.hexLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.hexLayer.setAttribute("class", "hex-layer");
        
        this.borderLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.borderLayer.setAttribute("class", "border-layer");
        
        this.railwaysLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
        this.railwaysLayer.setAttribute("class", "railways-layer");
        
        // 添加图层到SVG - 修改顺序，确保铁路在最上层
        this.gameLayer.appendChild(this.backgroundLayer);
        this.gameLayer.appendChild(this.hexLayer);
        this.gameLayer.appendChild(this.borderLayer);
        this.gameLayer.appendChild(this.railwaysLayer); // 铁路层放在最后，确保在最上面
        
        this.svg.appendChild(this.gameLayer);
        
        // 将SVG添加到容器
        this.container.appendChild(this.svg);
    }

    /**
     * 创建六角格网格
     * @private
     */
    _createHexGrid() {
        // 清空当前地图
        this.hexLayer.innerHTML = '';
        this.railwaysLayer.innerHTML = '';
        this.hexagons = {};

        // 获取地图数据来创建格子
        fetch('/api/map-data')
            .then(response => response.json())
            .then(mapData => {
                if (!mapData || !mapData.regions) {
                    console.error("无法获取地图数据或区域信息");
                    return;
                }
                
                console.log("获取地图数据成功:", mapData);
                
                // 创建一个Set来存储所有需要创建的六边形坐标
                const hexCoords = new Set();
                
                // 遍历所有区域的六边形
                mapData.regions.forEach(region => {
                    if (region.hex_tiles && region.hex_tiles.length > 0) {
                        region.hex_tiles.forEach(tile => {
                            // 将坐标添加到Set中，避免重复
                            hexCoords.add(`${tile.q},${tile.r}`);
                        });
                    }
                });
                
                console.log(`需要创建 ${hexCoords.size} 个六边形`);
                
                // 创建所有需要的六边形
                hexCoords.forEach(coordStr => {
                    const [q, r] = coordStr.split(',').map(Number);
                    const s = -q - r;
                    this._createHexagon(q, r, s);
                });
            })
            .catch(error => {
                console.error("获取地图数据失败:", error);
                // 出错时使用备用方法创建地图
                this._createBackupHexGrid();
            });
    }
    
    /**
     * 备用网格创建方法，当API调用失败时使用
     * @private
     */
    _createBackupHexGrid() {
        console.log("使用备用方法创建地图");
        // 定义网格范围，调整为符合新坐标系统的范围
        const minQ = -10;
        const maxQ = 20;
        const minR = -5;
        const maxR = 15;
        
        // 生成网格，使用欧洲地图的形状
        for (let q = minQ; q <= maxQ; q++) {
            for (let r = minR; r <= maxR; r++) {
                // 限制区域，模拟欧洲地图形状
                if (this._isValidHex(q, r)) {
                    const s = -q - r;
                    this._createHexagon(q, r, s);
                }
            }
        }
    }

    /**
     * 判断坐标是否在有效范围内(模拟欧洲地图形状)
     * @param {number} q 
     * @param {number} r 
     * @returns {boolean}
     * @private
     */
    _isValidHex(q, r) {
        // 根据新的地图坐标限制六边形的生成范围
        if (q < -10 || q > 20 || r < -5 || r > 15) {
            return false;
        }
        
        // 左下角区域限制
        if (q < -9 && r > 12) return false;
        
        // 右上角区域限制
        if (q > 18 && r < -3) return false;
        
        // 左上角限制
        if (q < -6 && r < -3) return false;
        
        // 右下角限制
        if (q > 14 && r > 8) return false;
        
        return true;
    }

    /**
     * 创建一个六边形
     * @param {number} q 列坐标
     * @param {number} r 行坐标
     * @param {number} s 第三坐标
     * @private
     */
    _createHexagon(q, r, s) {
        const size = this.hexSize;
        // 计算六边形的宽度和高度（扁平式六边形）
        const width = size * 2;  // 六边形的宽度
        const height = Math.sqrt(3) * size;  // 六边形的高度
        
        // 计算像素坐标，使六边形紧密相邻
        const x = q * width * 3/4;  // 水平方向的偏移
        
        // 修改垂直方向偏移的计算逻辑
        let yOffset;
        if (q < 0) {
            // 负数q值的情况保持不变
            yOffset = (q % 2) * (height/2);
        } else {
            // 正数q值的情况，奇数列向上偏移
            yOffset = (q % 2) * (-height/2);
        }
        const y = r * height + yOffset;  // 垂直方向的偏移
        
        // 创建六边形路径
        const hexagon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
        const points = this._calculateHexPoints(x, y, size);
        
        // 判断是否为自定义地图页面
        const isCustomMap = this.containerId.includes('custom') || this.containerId.includes('game-map-');
        
        if (isCustomMap) {
            hexagon.setAttribute("fill", "#fff"); // 白色填充
            hexagon.setAttribute("stroke", "#888"); // 灰色边缘
            hexagon.setAttribute("stroke-width", "2");
        } else {
            hexagon.setAttribute("fill", `url(#${this.grassPatternId})`);
            hexagon.setAttribute("stroke", "#222");
            hexagon.setAttribute("stroke-width", "2");
        }
        
        hexagon.setAttribute("points", points.map(p => p.join(",")).join(" "));
        hexagon.setAttribute("class", "hex-shape");
        hexagon.setAttribute("data-q", q);
        hexagon.setAttribute("data-r", r);
        hexagon.setAttribute("data-s", s);
        
        // 创建一个组来包含六边形
        const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
        group.appendChild(hexagon);
        
        // 添加点击事件
        group.addEventListener("click", (e) => {
            // 获取六边形坐标
            const q = parseInt(hexagon.getAttribute('data-q'));
            const r = parseInt(hexagon.getAttribute('data-r'));
            const s = parseInt(hexagon.getAttribute('data-s'));
            
            // 防止快速重复点击
            if (!this.lastClickTime) {
                this.lastClickTime = 0;
            }
            
            const now = Date.now();
            if (now - this.lastClickTime < 300) { // 300ms内的点击忽略
                return;
            }
            
            this.lastClickTime = now;
            
            // 记录最后点击的坐标
            this.lastClickedCoords = {q, r, s};
            console.log(`六边形点击: (${q}, ${r}, ${s})`);
            
            // 检查这个六边形是否有城镇
            const hexKey = `${q},${r},${s}`;
            const hex = this.hexagons[hexKey];
            if (hex && hex.town) {
                console.log(`点击了城镇六边形，城镇名称: ${hex.town.name}`);
                
                // 首先尝试调用window.handleTownClick函数
                if (typeof window.handleTownClick === 'function') {
                    window.handleTownClick(q, r, s, hex.town);
                }
            }
            
            // 调用回调函数
            if (this.onHexClick) {
                this.onHexClick(q, r, s);
            }
            
            // 阻止事件冒泡
            e.stopPropagation();
        });
        
        this.hexLayer.appendChild(group);
        
        // 存储六边形引用
        this.hexagons[`${q},${r},${s}`] = {
            element: hexagon,
            group: group,
            q: q,
            r: r,
            s: s,
            x: x,
            y: y
        };
    }

    /**
     * 计算六边形顶点
     * @param {number} x 中心x坐标
     * @param {number} y 中心y坐标
     * @param {number} size 六边形大小
     * @returns {string} 顶点坐标字符串
     * @private
     */
    _calculateHexPoints(x, y, size) {
        // 扁平式六边形的六个顶点
        const points = [];
        // 从右侧顶点开始，顺时针绘制六个顶点
        points.push([x + size, y]);  // 右
        points.push([x + size/2, y + size * Math.sqrt(3)/2]);  // 右下
        points.push([x - size/2, y + size * Math.sqrt(3)/2]);  // 左下
        points.push([x - size, y]);  // 左
        points.push([x - size/2, y - size * Math.sqrt(3)/2]);  // 左上
        points.push([x + size/2, y - size * Math.sqrt(3)/2]);  // 右上
        
        return points;
    }

    /**
     * 选择一个六边形
     * @param {number} q 列坐标
     * @param {number} r 行坐标
     * @param {number} s 第三坐标
     * @param {boolean} clearMap 是否清除当前地图和铁路，默认为false
     * @private
     */
    _selectHex(q, r, s, clearMap = false) {
        // 取消之前选中的六角形
        if (this.selectedHex) {
            this.selectedHex.element.classList.remove("selected");
        }
        
        // 选中新的六角形
        const key = `${q},${r},${s}`;
        if (this.hexagons[key]) {
            this.selectedHex = this.hexagons[key];
            this.selectedHex.element.classList.add("selected");
            
            // 如果设置了点击回调，则调用它
            if (this.onHexClick) {
                this.onHexClick(q, r, s);
            }
            
            return this.hexagons[key];
        }
        
        return null;
    }

    /**
     * 添加城镇到地图上
     * @param {number} q - 六边形格子的q坐标
     * @param {number} r - 六边形格子的r坐标
     * @param {number} s - 六边形格子的s坐标
     * @param {string} name - 城镇名称
     * @param {string} owner - 城镇所属玩家
     * @param {string} level - 城镇等级
     */
    addTown(q, r, s, name, owner, level) {
        const hexKey = `${q},${r},${s}`;
        if (!this.hexagons[hexKey]) {
            console.error(`找不到六边形: ${hexKey}`);
            return;
        }
        
        const hex = this.hexagons[hexKey];
        
        // 判断是否是合并城镇（名称中包含"-"）
        const isMergedTown = name && name.includes(' - ');
        
        // 记录城镇属性
        hex.town = {
            name: name,
            owner: owner,
            level: level,
            isMerged: isMergedTown
        };
        
        // 移除现有图标
        const existingIcon = hex.group.querySelector(".town-icon");
        if (existingIcon) {
            hex.group.removeChild(existingIcon);
        }
        
        // 移除现有名称
        const existingName = hex.group.querySelector(".town-name");
        if (existingName) {
            hex.group.removeChild(existingName);
        }
        
        // 使用图片替代圆形作为城镇图标
        const townIcon = document.createElementNS("http://www.w3.org/2000/svg", "image");
        townIcon.setAttribute("class", `town-icon ${owner === "德军" ? "german" : "entente"}`);
        
        // 添加合并城镇标记（如果是合并城镇）
        if (isMergedTown) {
            townIcon.classList.add("merged-town");
            
            // 直接使用内联样式覆盖CSS中的动画
            townIcon.style.filter = "brightness(1.2) saturate(1.2)";
            
            // 检查是否是新升级的城镇
            const isNewlyUpgraded = window.lastUpgradedTown === name && 
                               (Date.now() - window.lastUpgradeTime < 5000);
            
            if (isNewlyUpgraded) {
                // 仅为新升级的城镇添加短暂动画效果
                console.log(`为新升级的城镇 ${name} 添加临时动画效果`);
                // 使用CSS中定义的动画，但只执行一次
                townIcon.style.animation = "pulse 2s ease-in-out";
                
                // 动画结束后移除
                setTimeout(() => {
                    if (townIcon.parentNode) {
                        townIcon.style.animation = "none";
                    }
                }, 2100);
            } else {
                // 对于非新升级的城镇，禁用动画
                townIcon.style.animation = "none";
            }
        }
        
        // 将英文等级转换为中文
        let displayLevel = level;
        const levelMap = {
            'village': '村落',
            'small_city': '小城市', 
            'large_city': '大城市'
        };
        
        // 如果是英文等级，转换为中文
        if (levelMap[level]) {
            displayLevel = levelMap[level];
        }
        
        // 根据城镇等级设置不同的图标
        let iconPath = "";
        let iconSize = 30; // 默认图标大小
        
        if (displayLevel === "村落") {
            iconPath = "/static/images/村.png";
            iconSize = 24;
        } else if (displayLevel === "小城市") {
            iconPath = "/static/images/镇.png";
            iconSize = 28;
        } else if (displayLevel === "大城市") {
            iconPath = "/static/images/城.png";
            iconSize = 32;
        } else {
            // 默认使用村落图标
            console.warn(`未知城镇等级: ${level}，使用默认村落图标`);
            iconPath = "/static/images/村.png";
            iconSize = 24;
        }
        
        console.log(`添加城镇图标: 等级=${level}, 显示等级=${displayLevel}, 图标路径=${iconPath}, 是否合并城镇=${isMergedTown}`);
        
        townIcon.setAttribute("href", iconPath);
        townIcon.setAttribute("width", iconSize);
        townIcon.setAttribute("height", iconSize);
        townIcon.setAttribute("x", hex.x - iconSize/2);
        townIcon.setAttribute("y", hex.y - iconSize/2);
        
        // 添加自定义属性，用于合并城镇高亮
        townIcon.setAttribute("data-town-name", name);
        townIcon.setAttribute("data-town-level", level);
        townIcon.setAttribute("data-is-merged", isMergedTown ? "true" : "false");
        
        // 如果城镇属于玩家（当前用户），添加激活样式
        if (owner === window.currentPlayer) {
            hex.element.classList.add("active-town");
        } else if (owner && owner !== window.currentPlayer) {
            hex.element.classList.add("enemy-town");
        }
        
        // 为城镇图标添加点击事件
        townIcon.addEventListener("click", (e) => {
            console.log(`城镇图标点击: ${name}, 等级: ${level}, 在 (${q},${r},${s}), 是否合并城镇: ${isMergedTown}`);
            
            // 防止快速重复点击
            const now = Date.now();
            if (!this.lastClickTime) {
                this.lastClickTime = 0;
            }
            if (now - this.lastClickTime < 300) { // 300ms内的点击忽略
                return;
            }
            this.lastClickTime = now;
            
            // 记录最后点击的坐标
            this.lastClickedCoords = {q, r, s};
            
            // 检查当前是否处于升级城镇模式
            if (window.upgradeTownMode && typeof window.handleTownUpgradeClick === 'function') {
                console.log('城镇图标点击: 当前处于升级模式，调用handleTownUpgradeClick');
                window.handleTownUpgradeClick(q, r, s, hex.town);
            } else if (typeof window.handleTownClick === 'function') {
                // 正常模式下调用城镇点击处理函数
                window.handleTownClick(q, r, s, hex.town);
            }
            
            // 阻止事件冒泡 - 确保不会触发格子的点击事件
            e.stopPropagation();
        });
        
        // 添加城镇名称 - 对合并城镇显示短名称
        const townName = document.createElementNS("http://www.w3.org/2000/svg", "text");
        townName.setAttribute("x", hex.x);
        townName.setAttribute("y", hex.y + iconSize/2 + 15);  // 位置在图标下方
        townName.setAttribute("class", "town-name");
        
        // 如果是合并城镇，只显示简化名称以避免文字重叠
        if (isMergedTown) {
            // 获取合并城镇中的第一部分名称，或者使用简短标识
            const nameParts = name.split(' - ');
            // 如果文本太长，只显示第一个城镇名称
            townName.textContent = nameParts[0];
            townName.classList.add("merged-name");
        } else {
            townName.textContent = name;
        }
        
        // 将图标和名称添加到六边形组
        hex.group.appendChild(townIcon);
        hex.group.appendChild(townName);
        
        console.log(`城镇已添加: ${name} 在 (${q},${r},${s}), 等级: ${level}`);
    }

    /**
     * 清除所有城镇高亮效果
     */
    clearAllTownHighlights() {
        // 清除所有城镇的高亮样式
        const townIcons = document.querySelectorAll(".town-icon");
        townIcons.forEach(icon => {
            icon.classList.remove("town-merge-highlight");
        });
        
        // 清除所有六边形的高亮样式
        for (const hexId in this.hexagons) {
            this.hexagons[hexId].element.classList.remove("town-merge-hex-highlight");
        }
    }

    /**
     * 查找合并城镇的所有六边形
     * @param {string} townName 城镇名称
     * @returns {Array} 六边形对象数组
     */
    findAllTownHexes(townName) {
        const result = [];
        
        // 查找所有有相同城镇名称的六边形
        for (const hexId in this.hexagons) {
            const hex = this.hexagons[hexId];
            if (hex.town && hex.town.name === townName) {
                result.push(hex);
            }
        }
        
        return result;
    }

    /**
     * 添加铁路
     * @param {number} q1 起点列坐标
     * @param {number} r1 起点行坐标
     * @param {number} s1 起点第三坐标
     * @param {number} q2 终点列坐标
     * @param {number} r2 终点行坐标
     * @param {number} s2 终点第三坐标
     * @param {string} level 铁路等级
     */
    addRailway(q1, r1, s1, q2, r2, s2, level = "一级铁路") {
        const key1 = `${q1},${r1},${s1}`;
        const key2 = `${q2},${r2},${s2}`;
        
        console.log(`添加铁路: 从(${q1},${r1},${s1})到(${q2},${r2},${s2}), 等级: ${level}`);
        
        if (!(key1 in this.hexagons) || !(key2 in this.hexagons)) {
            console.error(`铁路添加失败: 找不到六边形 ${key1} 或 ${key2}`);
            return;
        }
        
        const hex1 = this.hexagons[key1];
        const hex2 = this.hexagons[key2];
        
        // 创建铁路线
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", hex1.x);
        line.setAttribute("y1", hex1.y);
        line.setAttribute("x2", hex2.x);
        line.setAttribute("y2", hex2.y);
        line.setAttribute("class", "railway-path");
        
        // 设置铁路样式 - 使用更鲜明的颜色和更粗的线条
        line.setAttribute("stroke-width", "12"); // 增加线宽
        line.setAttribute("stroke", "#FF00FF"); // 鲜艳的紫红色
        line.setAttribute("stroke-opacity", "0.8"); // 半透明
        
        // 添加白色描边使铁路更明显
        line.setAttribute("stroke-linecap", "round");
        
        // 设置铁路等级样式
        if (level === "二级铁路") {
            line.setAttribute("stroke-dasharray", "10,5"); // 二级铁路使用更明显的虚线
        }
        
        // 确保铁路在最前面显示
        if (this.railwaysLayer.firstChild) {
            this.railwaysLayer.insertBefore(line, this.railwaysLayer.firstChild);
        } else {
            this.railwaysLayer.appendChild(line);
        }
        
        // 存储铁路信息
        this.railways.push({
            element: line,
            start: { q: q1, r: r1, s: s1 },
            end: { q: q2, r: r2, s: s2 },
            level: level
        });
        
        console.log(`铁路添加成功, 当前铁路总数: ${this.railways.length}`);
    }

    /**
     * 获取区域边框颜色
     * @param {string} regionId 区域ID
     * @returns {string} 边框颜色
     */
    getBorderColor(regionId) {
        if (!regionId) return '#CCCCCC';  // 默认灰色
        
        const prefix = regionId.substring(0, 2);
        
        // 根据用户要求设置边框颜色
        const borderColorMap = {
            'FR': '#0072B5',  // 法国：蓝色边框
            'BE': '#FF9999',  // 比利时：浅红色边框
            'GE': '#D62728'   // 德国：红色边框
        };
        
        // 冲突区域使用特殊颜色标记
        if (regionId === 'FR-3' || regionId === 'GE-3') {
            return '#32CD32';  // 冲突区域：绿色边框
        }
        
        return borderColorMap[prefix] || '#CCCCCC';
    }
    
    /**
     * 更新地图
     * @param {Object} gameState 游戏状态
     * @param {boolean} preserveRailways 是否保留已有的铁路，默认为true
     */
    updateMap(gameState, preserveRailways = true) {
        console.log("开始更新地图...");
        
        // 创建一个二维坐标到六边形的映射，简化查找
        const hexMapByCoords = {};
        for (const hexId in this.hexagons) {
            const hex = this.hexagons[hexId];
            // 使用二维坐标作为键
            const key = `${hex.q},${hex.r}`;
            hexMapByCoords[key] = hex;
        }

        // 保存当前铁路以备后续恢复
        const currentRailways = [...this.railways];
        
        // 重置所有六边形的状态
        console.log("重置所有六边形状态...");
        for (const hexId in this.hexagons) {
            const hex = this.hexagons[hexId];
            // 清除所有类，确保每次更新都重置样式
            hex.element.classList.remove("active-town", "enemy-town", "in-region", "conflict-region");
            // 移除所有区域类名
            hex.element.classList.remove("region-fr", "region-be", "region-ge");
            
            // 始终重置样式，不再根据类名判断
            hex.element.style.stroke = '#333333';
            hex.element.style.strokeWidth = '1px';
            hex.element.style.fill = 'rgba(255,255,255,0.2)';
            
            // 移除现有的标签和图标
            const existingLabels = hex.group.querySelectorAll(".region-label, .town-icon, .town-name");
            existingLabels.forEach(label => hex.group.removeChild(label));
            
            // 移除现有的背景图片
            const existingImage = hex.group.querySelector(".hex-background");
            if (existingImage) {
                hex.group.removeChild(existingImage);
            }
            
            // 为所有六边形添加草坪背景图
            const grassImage = document.createElementNS("http://www.w3.org/2000/svg", "image");
            grassImage.setAttribute("class", "hex-background");
            grassImage.setAttribute("href", "/static/images/草坪.png");
            grassImage.setAttribute("x", hex.x - this.hexSize - 2);
            grassImage.setAttribute("y", hex.y - this.hexSize * Math.sqrt(3)/2 - 2);
            grassImage.setAttribute("width", this.hexSize * 2 + 4);
            grassImage.setAttribute("height", this.hexSize * Math.sqrt(3) + 4);
            grassImage.setAttribute("preserveAspectRatio", "none");
            // 设置透明度为50%
            grassImage.setAttribute("opacity", "0.5");
            
            // 确保图片在下方，六边形轮廓在上方
            hex.group.insertBefore(grassImage, hex.group.firstChild);
            
            delete hex.town;
        }
        
        // 清除铁路，除非要保留
        if (!preserveRailways) {
            this.railwaysLayer.innerHTML = '';
            this.railways = [];
        } else {
            // 如果保留铁路，先清空数组但不删除图形元素
            this.railways = [];
        }
        
        // 更新区域
        this.regions = {};
        
        // 记录所有已添加的城镇坐标，避免重复添加
        const addedTowns = new Set();
        // 记录所有已添加的铁路，避免重复添加
        const addedRailways = new Set();
        
        // 收集所有合并城镇信息，用于稍后处理
        const mergedTowns = [];
        
        // 根据区域信息更新六边形状态
        gameState.regions.forEach(region => {
            this.regions[region.id] = region;
            
            // 判断区域类型，添加对应的CSS类名
            let regionClass = '';
            let borderColor = '';
            if (region.id.startsWith('FR')) {
                regionClass = 'region-fr';  // 法国
                borderColor = '#0072B5';
            } else if (region.id.startsWith('BE')) {
                regionClass = 'region-be';  // 比利时
                borderColor = '#FF9999';
            } else if (region.id.startsWith('GE')) {
                regionClass = 'region-ge';  // 德国
                borderColor = '#D62728';
            }
            
            // 检查是否是冲突区域
            const isConflictRegion = (region.id === 'FR-3' || region.id === 'GE-3');
            
            // 判断该区域是否被选中
            const isSelected = window.selectedRegion && window.selectedRegion.id === region.id;
            
            // 如果是选中的区域，打印日志帮助调试
            if (isSelected) {
                console.log(`处理选中区域 ${region.id} 的格子，总数: ${region.hex_tiles.length}`);
            }
            
            // 创建一个映射来存储该区域的所有格子坐标
            const regionHexes = new Set();
            if (region.hex_tiles && region.hex_tiles.length > 0) {
                region.hex_tiles.forEach(tile => {
                    regionHexes.add(`${tile.q},${tile.r}`);
                });
            } else {
                console.warn(`区域 ${region.name} 没有六边形格子`);
                return; // 跳过没有格子的区域
            }
            
            // 首先收集该区域的所有六边形
            const regionHexObjects = [];
            for (const hexId in this.hexagons) {
                const hex = this.hexagons[hexId];
                const hexKey = `${hex.q},${hex.r}`;
                
                if (regionHexes.has(hexKey)) {
                    regionHexObjects.push(hex);
                }
            }
            
            // 计算区域中心点，用于放置标签
            let centerX = 0, centerY = 0;
            
            // 检查特殊格子
            if (isSelected) {
                console.log(`区域${region.id}的格子列表:`);
                regionHexObjects.forEach(hex => {
                    console.log(`格子(${hex.q}, ${hex.r})`);
                });
            }
            
            // 然后统一处理该区域的所有六边形
            regionHexObjects.forEach(hex => {
                // 添加区域CSS类名
                if (regionClass) {
                    hex.element.classList.add(regionClass);
                    // 直接设置区域边框颜色
                    hex.element.style.stroke = borderColor;
                    hex.element.style.strokeWidth = '2px';
                }
                
                // 如果是冲突区域，添加特殊标记
                if (isConflictRegion) {
                    hex.element.classList.add('conflict-region');
                }
                
                // 计算区域中心点
                centerX += hex.x;
                centerY += hex.y;
                
                // 统一处理选中区域的高亮效果
                if (isSelected) {
                    // 重置所有样式，确保统一效果
                    hex.element.className.baseVal = "hex-shape"; // 重置类名为初始状态
                    if (regionClass) {
                        hex.element.classList.add(regionClass);
                    }
                    if (isConflictRegion) {
                        hex.element.classList.add('conflict-region');
                    }
                    hex.element.classList.add('in-region');
                    
                    // 清除所有内联样式
                    hex.element.style = "";
                    
                    // 重新应用统一样式 - 使用固定的透明度值
                    hex.element.style.stroke = borderColor;
                    hex.element.style.strokeWidth = '2px';
                    hex.element.style.fill = 'rgba(255,255,255,0.2)'; // 固定透明度
                    
                    // 不设置任何动画或过滤器效果
                    const bgImage = hex.group.querySelector(".hex-background");
                    if (bgImage) {
                        bgImage.style = ""; // 清除所有样式
                    }
                }
            });
            
            // 更新中心点计算
            if (regionHexObjects.length > 0) {
                centerX /= regionHexObjects.length;
                centerY /= regionHexObjects.length;
            }
            
            // 先识别所有合并城镇（名称中包含"-"）
            if (region.towns && region.towns.length > 0) {
                region.towns.forEach(town => {
                    if (town.name && town.name.includes(' - ') && town.coords) {
                        // 这是一个合并城镇，解析原始城镇名称
                        const originalTownNames = town.name.split(' - ');
                        if (originalTownNames.length === 2) {
                            mergedTowns.push({
                                regionId: region.id,
                                mergedTown: town,
                                originalNames: originalTownNames
                            });
                            console.log(`发现合并城镇: ${town.name}, 等级: ${town.level}`);
                        }
                    }
                });
            }
            
            // 标记城镇
            if (region.towns && region.towns.length > 0) {
                region.towns.forEach(town => {
                    // 判断是否是合并城镇
                    const isMergedTown = town.name && town.name.includes(' - ');
                    
                    if (town.coords) {
                        // 使用二维坐标作为城镇位置标识
                        const townKey = `${town.coords.q},${town.coords.r}`;
                        
                        // 如果是合并城镇，此时先不处理，稍后统一处理
                        if (isMergedTown) {
                            return;
                        }
                        
                        if (!addedTowns.has(townKey)) {
                            console.log(`添加城镇: ${town.name} 在 (${town.coords.q},${town.coords.r})`);
                            
                            // 确认s坐标存在，如果不存在则添加默认值
                            const s = town.coords.s || -(town.coords.q + town.coords.r);
                            
                            this.addTown(
                                town.coords.q, 
                                town.coords.r, 
                                s, 
                                town.name, 
                                town.owner, 
                                town.level
                            );
                            addedTowns.add(townKey);
                        }
                    } else {
                        console.warn(`城镇 ${town.name} 没有坐标信息`);
                    }
                });
            }
            
            // 添加区域内的铁路
            if (region.railways && Array.isArray(region.railways)) {
                region.railways.forEach(railway => {
                    if (railway.start && railway.end) {
                        // 确定s坐标，如果不存在则计算
                        const s1 = railway.start.s || -(railway.start.q + railway.start.r);
                        const s2 = railway.end.s || -(railway.end.q + railway.end.r);
                        
                        // 创建一个铁路唯一标识（仅使用二维坐标），防止重复添加
                        const startKey = `${railway.start.q},${railway.start.r}`;
                        const endKey = `${railway.end.q},${railway.end.r}`;
                        const railwayKey = `${startKey}-${endKey}`;
                        const reverseRailwayKey = `${endKey}-${startKey}`;
                        
                        if (!addedRailways.has(railwayKey) && !addedRailways.has(reverseRailwayKey)) {
                            this.addRailway(
                                railway.start.q,
                                railway.start.r,
                                s1,
                                railway.end.q,
                                railway.end.r,
                                s2,
                                railway.level || "一级铁路"
                            );
                            addedRailways.add(railwayKey);
                        }
                    }
                });
            }
        });
        
        // 处理全局铁路
        if (gameState.railways && Array.isArray(gameState.railways)) {
            console.log("处理全局铁路列表...", gameState.railways);
            gameState.railways.forEach(railway => {
                if (railway.start && railway.end) {
                    // 确定s坐标，如果不存在则计算
                    const s1 = railway.start.s || -(railway.start.q + railway.start.r);
                    const s2 = railway.end.s || -(railway.end.q + railway.end.r);
                    
                    // 创建一个铁路唯一标识（仅使用二维坐标），防止重复添加
                    const startKey = `${railway.start.q},${railway.start.r}`;
                    const endKey = `${railway.end.q},${railway.end.r}`;
                    const railwayKey = `${startKey}-${endKey}`;
                    const reverseRailwayKey = `${endKey}-${startKey}`;
                    
                    if (!addedRailways.has(railwayKey) && !addedRailways.has(reverseRailwayKey)) {
                        this.addRailway(
                            railway.start.q,
                            railway.start.r,
                            s1,
                            railway.end.q,
                            railway.end.r,
                            s2,
                            railway.level || "一级铁路"
                        );
                        addedRailways.add(railwayKey);
                    }
                }
            });
        }
        
        // 处理所有合并城镇
        if (mergedTowns.length > 0) {
            console.log(`开始处理 ${mergedTowns.length} 个合并城镇...`);
            
            mergedTowns.forEach(mergedTownInfo => {
                const mergedTown = mergedTownInfo.mergedTown;
                
                if (!mergedTown || !mergedTown.coords) {
                    console.warn(`合并城镇数据不完整:`, mergedTownInfo);
                    return;
                }
                
                console.log(`处理合并城镇: ${mergedTown.name}`);
                
                // 查找所有引用该合并城镇的六边形格子
                const townHexes = [];
                
                // 1. 首先从合并城镇当前坐标开始添加
                const mainHexKey = `${mergedTown.coords.q},${mergedTown.coords.r}`;
                if (!addedTowns.has(mainHexKey)) {
                    const s = mergedTown.coords.s || -(mergedTown.coords.q + mergedTown.coords.r);
                    
                    // 添加主要城镇图标
                    this.addTown(
                        mergedTown.coords.q,
                        mergedTown.coords.r,
                        s,
                        mergedTown.name,
                        mergedTown.owner,
                        mergedTown.level
                    );
                    
                    addedTowns.add(mainHexKey);
                    townHexes.push(mainHexKey);
                }
                
                // 2. 如果在进入合并前已经选择了两个城镇位置，我们需要查找另一个位置
                // 在游戏状态的hex_tiles中查找所有引用该城镇的格子
                for (const region of gameState.regions) {
                    if (region.id === mergedTownInfo.regionId && region.hex_tiles) {
                        for (const hex of region.hex_tiles) {
                            if (hex.town === mergedTown.name) {
                                const hexKey = `${hex.q},${hex.r}`;
                                
                                // 如果这个格子不是主要位置且尚未添加过城镇
                                if (hexKey !== mainHexKey && !addedTowns.has(hexKey)) {
                                    const s = hex.s || -(hex.q + hex.r);
                                    
                                    // 在第二个位置也添加相同等级的城镇图标
                                    this.addTown(
                                        hex.q,
                                        hex.r,
                                        s,
                                        mergedTown.name, // 使用合并后的名称
                                        mergedTown.owner,
                                        mergedTown.level
                                    );
                                    
                                    addedTowns.add(hexKey);
                                    townHexes.push(hexKey);
                                }
                            }
                        }
                    }
                }
                
                // 如果仍然没有找到第二个格子，说明服务器没有提供完整信息
                // 我们从合并城镇的名称中获取原始城镇名称，在地图上查找它们的位置
                if (townHexes.length < 2) {
                    // 尝试从region的所有towns中找到原来两个城镇的位置
                    for (const region of gameState.regions) {
                        if (region.id === mergedTownInfo.regionId && region.hex_tiles) {
                            for (const hex of region.hex_tiles) {
                                // 检查原始城镇名称的引用
                                if (hex.originalTownName && mergedTownInfo.originalNames.includes(hex.originalTownName)) {
                                    const hexKey = `${hex.q},${hex.r}`;
                                    
                                    // 如果这个格子不是主要位置且尚未添加过城镇
                                    if (hexKey !== mainHexKey && !addedTowns.has(hexKey)) {
                                        const s = hex.s || -(hex.q + hex.r);
                                        
                                        // 在这个位置也添加相同等级的城镇图标
                                        this.addTown(
                                            hex.q,
                                            hex.r,
                                            s,
                                            mergedTown.name, // 使用合并后的名称
                                            mergedTown.owner,
                                            mergedTown.level
                                        );
                                        
                                        addedTowns.add(hexKey);
                                        townHexes.push(hexKey);
                                    }
                                }
                            }
                        }
                    }
                }
                
                console.log(`合并城镇 ${mergedTown.name} 已在 ${townHexes.length} 个位置显示图标`);
            });
        }
        
        // 如果需要保留之前的铁路，则还原它们
        if (preserveRailways && currentRailways.length > 0) {
            // 将之前的铁路添加回来，但避免重复
            currentRailways.forEach(railway => {
                if (railway.start && railway.end) {
                    const startKey = `${railway.start.q},${railway.start.r}`;
                    const endKey = `${railway.end.q},${railway.end.r}`;
                    const railwayKey = `${startKey}-${endKey}`;
                    const reverseRailwayKey = `${endKey}-${startKey}`;
                    
                    if (!addedRailways.has(railwayKey) && !addedRailways.has(reverseRailwayKey)) {
                        // 恢复之前的铁路元素，而不是创建新的
                        if (railway.element) {
                            this.railwaysLayer.appendChild(railway.element);
                        } else {
                            // 确定s坐标，如果不存在则计算
                            const s1 = railway.start.s || -(railway.start.q + railway.start.r);
                            const s2 = railway.end.s || -(railway.end.q + railway.end.r);
                            
                            // 如果没有元素，创建新的
                            this.addRailway(
                                railway.start.q,
                                railway.start.r,
                                s1,
                                railway.end.q,
                                railway.end.r,
                                s2,
                                railway.level
                            );
                        }
                        addedRailways.add(railwayKey);
                    }
                }
            });
        }
        
        console.log("地图更新完成, 添加了 " + addedRailways.size + " 条铁路");

        // 在更新铁路网络之后，添加显示军队的代码（在代码最后添加）
        // 清除之前的军队
        this.clearArmies();
        
        // 显示新的军队
        if (gameState.armies && gameState.armies.length > 0) {
            gameState.armies.forEach(army => {
                if (army.current_position) {
                    this.showArmy(
                        army.current_position.q,
                        army.current_position.r,
                        army.current_position.s,
                        army.amount,
                        army.status,
                        army.owner
                    );
                }
            });
        }
    }

    /**
     * 添加区域边界
     * @param {Array} regions 区域数组
     * @private
     */
    _addRegionBorders(regions) {
        if (!regions || !regions.length) return;
        
        // 清除现有边界
        this.borderLayer.innerHTML = '';
        
        // 边界坐标集合，用于存储需要绘制边界的边
        const borders = {};
        
        // 遍历所有区域，找出需要绘制边界的位置
        regions.forEach(region => {
            if (!region.hex_tiles || !region.hex_tiles.length) return;
            
            // 获取区域的所有六边形
            const regionHexes = region.hex_tiles.map(tile => {
                return {q: tile.q, r: tile.r, s: tile.s};
            });
            
            // 找出区域边界边
            for (const hex of regionHexes) {
                // 检查六个方向的相邻格子
                const neighbors = this._getHexNeighbors(hex.q, hex.r, hex.s);
                
                for (const neighbor of neighbors) {
                    // 创建邻居坐标的键
                    const neighborKey = `${neighbor.q},${neighbor.r},${neighbor.s}`;
                    
                    // 检查邻居是否存在
                    const neighborExists = this.hexagons[neighborKey];
                    if (!neighborExists) continue;
                    
                    // 检查邻居是否在同一区域
                    const isNeighborInSameRegion = regionHexes.some(h => 
                        h.q === neighbor.q && h.r === neighbor.r && h.s === neighbor.s
                    );
                    
                    // 如果邻居不在同一区域，但在地图上，这条边是内部区域边界
                    if (!isNeighborInSameRegion && neighborExists) {
                        // 创建表示边的键
                        const edgeKey = this._createEdgeKey(
                            hex.q, hex.r, hex.s,
                            neighbor.q, neighbor.r, neighbor.s
                        );
                        
                        // 添加到边界集合
                        borders[edgeKey] = {
                            hex: hex,
                            neighbor: neighbor,
                            regionId: region.id
                        };
                    }
                }
            }
        });
        
        // 绘制所有边界边
        for (const edgeKey in borders) {
            const border = borders[edgeKey];
            
            // 获取两个六边形的数据
            const hexKey = `${border.hex.q},${border.hex.r},${border.hex.s}`;
            const neighborKey = `${border.neighbor.q},${border.neighbor.r},${border.neighbor.s}`;
            
            const hexObj = this.hexagons[hexKey];
            const neighborObj = this.hexagons[neighborKey];
            
            if (!hexObj || !neighborObj) continue;
            
            // 获取相对方向
            const direction = this._getDirection(border.hex, border.neighbor);
            
            // 获取边的端点
            const hexPoints = this._calculateHexPoints(hexObj.x, hexObj.y, this.hexSize);
            const start = hexPoints[direction];
            const end = hexPoints[(direction + 1) % 6];
            
            // 创建边界线
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", start.x);
            line.setAttribute("y1", start.y);
            line.setAttribute("x2", end.x);
            line.setAttribute("y2", end.y);
            line.setAttribute("class", "region-border");
            
            // 直接添加到专门的边界层
            this.borderLayer.appendChild(line);
        }
    }

    /**
     * 获取六边形的六个邻居坐标
     * @param {number} q 
     * @param {number} r 
     * @param {number} s 
     * @returns {Array} 邻居坐标数组
     * @private
     */
    _getHexNeighbors(q, r, s) {
        // 六边形的六个邻居方向
        const directions = [
            {q: 1, r: 0, s: -1},  // 东
            {q: 0, r: 1, s: -1},  // 东南
            {q: -1, r: 1, s: 0},  // 西南
            {q: -1, r: 0, s: 1},  // 西
            {q: 0, r: -1, s: 1},  // 西北
            {q: 1, r: -1, s: 0}   // 东北
        ];
        
        return directions.map(dir => ({
            q: q + dir.q,
            r: r + dir.r,
            s: s + dir.s
        }));
    }

    /**
     * 创建表示边的唯一键
     * @private
     */
    _createEdgeKey(q1, r1, s1, q2, r2, s2) {
        // 确保顺序一致，较小的坐标在前
        if (q1 > q2 || (q1 === q2 && r1 > r2) || (q1 === q2 && r1 === r2 && s1 > s2)) {
            [q1, r1, s1, q2, r2, s2] = [q2, r2, s2, q1, r1, s1];
        }
        
        return `${q1},${r1},${s1}-${q2},${r2},${s2}`;
    }

    /**
     * 获取相对方向
     * @private
     */
    _getDirection(from, to) {
        const dq = to.q - from.q;
        const dr = to.r - from.r;
        
        if (dq === 1 && dr === 0) return 0;      // 东
        if (dq === 0 && dr === 1) return 1;      // 东南
        if (dq === -1 && dr === 1) return 2;     // 西南
        if (dq === -1 && dr === 0) return 3;     // 西
        if (dq === 0 && dr === -1) return 4;     // 西北
        if (dq === 1 && dr === -1) return 5;     // 东北
        
        return 0; // 默认东方向
    }

    /**
     * 获取六边形边缘的两个端点
     * @private
     */
    _getHexEdgePoints(x, y, size, direction) {
        const angles = [0, 60, 120, 180, 240, 300]; // 六个方向的角度
        const angle1 = angles[direction] * Math.PI / 180;
        const angle2 = angles[(direction + 1) % 6] * Math.PI / 180;
        
        return {
            start: {
                x: x + size * Math.cos(angle1),
                y: y + size * Math.sin(angle1)
            },
            end: {
                x: x + size * Math.cos(angle2),
                y: y + size * Math.sin(angle2)
            }
        };
    }

    /**
     * 清空地图
     * @private
     */
    _clearMap() {
        // 清除城镇样式和信息
        Object.values(this.hexagons).forEach(hex => {
            hex.element.classList.remove("active-town", "enemy-town");
            
            const existingIcon = hex.group.querySelector(".town-icon");
            if (existingIcon) {
                hex.group.removeChild(existingIcon);
            }
            
            const existingName = hex.group.querySelector(".town-name");
            if (existingName) {
                hex.group.removeChild(existingName);
            }
            
            delete hex.town;
        });
        
        // 清除铁路
        this.railwaysLayer.innerHTML = '';
        this.railways = [];
    }

    /**
     * 设置六边形点击回调
     * @param {Function} callback 
     */
    setHexClickCallback(callback) {
        // 设置点击回调函数
        this.onHexClick = callback;
        
        // 查找所有六边形并添加点击事件
        const hexagons = this.hexLayer.querySelectorAll('polygon.hex-shape');
        
        hexagons.forEach(hex => {
            // 移除所有现有的点击事件，防止多次绑定
            const clone = hex.cloneNode(true);
            hex.parentNode.replaceChild(clone, hex);
            
            clone.addEventListener('click', (e) => {
                // 获取六边形坐标
                const q = parseInt(clone.getAttribute('data-q'));
                const r = parseInt(clone.getAttribute('data-r'));
                const s = parseInt(clone.getAttribute('data-s'));
                
                // 防止快速重复点击
                if (!this.lastClickTime) {
                    this.lastClickTime = 0;
                }
                
                const now = Date.now();
                if (now - this.lastClickTime < 300) { // 300ms内的点击忽略
                    return;
                }
                
                this.lastClickTime = now;
                
                // 记录最后点击的坐标
                this.lastClickedCoords = {q, r, s};
                console.log(`六边形点击: (${q}, ${r}, ${s})`);
                
                // 调用回调函数
                if (this.onHexClick) {
                    this.onHexClick(q, r, s);
                }
                
                // 阻止事件冒泡
                e.stopPropagation();
            });
        });
    }

    /**
     * 获取区域颜色
     * @param {Object} region 区域对象
     * @returns {string} 颜色值
     */
    getRegionColor(region) {
        // 如果没有区域，返回默认颜色
        if (!region) return '#FFFFFF';  // 白色背景
        
        // 根据区域ID前缀判断国家，设置对应的边框颜色
        if (region.id) {
            const prefix = region.id.substring(0, 2);
            
            // 颜色映射表，与地图规范文档一致
            const borderColorMap = {
                'FR': '#0072B5',  // 法国：蓝色
                'BE': '#FF9999',  // 比利时：浅红
                'GE': '#D62728'   // 德国：红色
            };
            
            // 冲突区域使用特殊颜色标记
            if (region.id === 'FR-3' || region.id === 'GE-3') {
                return '#32CD32';  // 冲突区域：绿色
            }
            
            return borderColorMap[prefix] || '#CCCCCC';
        }
        
        return '#FFFFFF';  // 默认为白色
    }

    /**
     * 创建示例高亮区域（模拟冲突区域）
     * @private
     */
    _createExampleHighlight() {
        // 根据规范文档高亮冲突区域 FR-3 和 GE-3
        const conflictRegions = ["FR-3", "GE-3"];
        
        // 为冲突区域添加绿色边框高亮
        const borderGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        borderGroup.setAttribute("class", "conflict-borders");
        
        // 这里只是设置一个标记，实际高亮会在updateMap中实现
        this.conflictRegions = conflictRegions;
        
        this.svg.appendChild(borderGroup);
    }

    /**
     * 在地图上显示军队
     * @param {number} q 列坐标
     * @param {number} r 行坐标
     * @param {number} s 第三坐标
     * @param {number} amount 军队数量
     * @param {string} status 军队状态
     * @param {string} owner 所属阵营
     */
    showArmy(q, r, s, amount, status, owner) {
        const key = `${q},${r},${s}`;
        if (!(key in this.hexagons)) {
            console.error(`无法找到格子 ${key}`);
            return;
        }
        
        const hex = this.hexagons[key];
        
        // 创建军队图标
        const armyGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
        armyGroup.setAttribute("class", "army-group");
        armyGroup.setAttribute("data-owner", owner);
        armyGroup.setAttribute("data-status", status);
        
        // 创建军队图标背景
        const armyBg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        armyBg.setAttribute("cx", hex.x);
        armyBg.setAttribute("cy", hex.y);
        armyBg.setAttribute("r", this.hexSize * 0.3);
        armyBg.setAttribute("fill", owner === "德军" ? "#3498db" : "#e74c3c");
        armyBg.setAttribute("fill-opacity", "0.7");
        armyBg.setAttribute("stroke", "#fff");
        armyBg.setAttribute("stroke-width", "2");
        
        // 创建军队数量文本
        const armyText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        armyText.setAttribute("x", hex.x);
        armyText.setAttribute("y", hex.y + 5); // 稍微向下调整文本位置
        armyText.setAttribute("text-anchor", "middle");
        armyText.setAttribute("font-size", "12px");
        armyText.setAttribute("fill", "#fff");
        armyText.setAttribute("font-weight", "bold");
        armyText.textContent = amount;
        
        // 添加到SVG
        armyGroup.appendChild(armyBg);
        armyGroup.appendChild(armyText);
        
        // 根据状态设置效果
        if (status === "生成中") {
            armyBg.setAttribute("fill-opacity", "0.4");
        } else if (status === "装载中") {
            armyBg.setAttribute("stroke-dasharray", "3,3");
        } else if (status === "运输中") {
            // 添加动画效果
            const animate = document.createElementNS("http://www.w3.org/2000/svg", "animate");
            animate.setAttribute("attributeName", "r");
            animate.setAttribute("from", this.hexSize * 0.3);
            animate.setAttribute("to", this.hexSize * 0.35);
            animate.setAttribute("dur", "1s");
            animate.setAttribute("repeatCount", "indefinite");
            armyBg.appendChild(animate);
        } else if (status === "已抵达") {
            // 添加星形标记
            const star = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
            const starPoints = this.generateStarPoints(hex.x, hex.y, 5, this.hexSize * 0.15, this.hexSize * 0.07);
            star.setAttribute("points", starPoints);
            star.setAttribute("fill", "#FFD700");
            star.setAttribute("stroke", "#fff");
            star.setAttribute("stroke-width", "1");
            armyGroup.appendChild(star);
        }
        
        // 添加到军队图层
        if (!this.armiesLayer) {
            this.armiesLayer = document.createElementNS("http://www.w3.org/2000/svg", "g");
            this.armiesLayer.setAttribute("class", "armies-layer");
            this.gameLayer.appendChild(this.armiesLayer);
        }
        
        this.armiesLayer.appendChild(armyGroup);
    }
    
    /**
     * 生成五角星的点坐标
     * @param {number} cx 中心x坐标
     * @param {number} cy 中心y坐标
     * @param {number} points 点数
     * @param {number} outerRadius 外半径
     * @param {number} innerRadius 内半径
     * @returns {string} 点坐标字符串
     */
    generateStarPoints(cx, cy, points, outerRadius, innerRadius) {
        let results = "";
        const angle = Math.PI / points;
        
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const currAngle = i * angle;
            const x = cx + radius * Math.sin(currAngle);
            const y = cy + radius * Math.cos(currAngle);
            
            results += (i === 0 ? "" : " ") + x + "," + y;
        }
        
        return results;
    }
    
    /**
     * 清除所有军队
     */
    clearArmies() {
        if (this.armiesLayer) {
            while (this.armiesLayer.firstChild) {
                this.armiesLayer.removeChild(this.armiesLayer.firstChild);
            }
        }
    }
} 