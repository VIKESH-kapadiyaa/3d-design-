import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import './index.css';

const months = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const monthColors = ["#00e5ff", "#1de9b6", "#00e6 green", "#76ff03", "#ffea00", "#ff9100", "#ff3d00", "#ff1744", "#f50057", "#d500f9", "#651fff", "#2979ff"];
const baseGenres = ["Action", "Drama", "Comedy", "Romance", "Animation", "Thriller", "Sci-Fi"];
const defaultGenreColors = ["#ff5252", "#448aff", "#ffb142", "#ff7979", "#33d9b2", "#706fd3", "#34ace0", "#ffda79", "#706fd3", "#b33939"];

const monthDict = {
    "jan": 0, "january": 0, "1": 0, "01": 0,
    "feb": 1, "february": 1, "2": 1, "02": 1,
    "mar": 2, "march": 2, "3": 2, "03": 2,
    "apr": 3, "april": 3, "4": 3, "04": 3,
    "may": 4, "5": 4, "05": 4,
    "jun": 5, "june": 5, "6": 5, "06": 5,
    "jul": 6, "july": 6, "7": 6, "07": 6,
    "aug": 7, "august": 7, "8": 7, "08": 7,
    "sep": 8, "sept": 8, "september": 8, "9": 8, "09": 8,
    "oct": 9, "october": 9, "10": 9,
    "nov": 10, "november": 10, "11": 10,
    "dec": 11, "december": 11, "12": 11
};

function getStringHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
}

function sanitizeData(rawJson) {
    if (!Array.isArray(rawJson)) return { data: [], stats: { total: 0, showing: 0, truncatedPerMonth: {} }, genres: [], genreColors: {} };
    
    // Initial validation and normalization
    const normalized = rawJson.map((d, i) => {
        const name = d.name?.toString() || d.title?.toString() || `Data ${i+1}`;
        
        // Flexible Month Parsing (handle "month", "date", or "monthIdx")
        let monthIdx = 0;
        if (d.monthIdx !== undefined) {
            monthIdx = parseInt(d.monthIdx);
        } else {
            const rawMonth = (d.month || d.date || "1").toString().toLowerCase().trim();
            // Try to parse date string if it looks like YYYY-MM-DD
            if (rawMonth.includes("-")) {
                const dateParts = rawMonth.split("-");
                if (dateParts.length >= 2) monthIdx = parseInt(dateParts[1]) - 1;
            } else {
                monthIdx = monthDict[rawMonth] !== undefined ? monthDict[rawMonth] : (parseInt(rawMonth) - 1 || 0);
            }
        }
        // Clamp month
        monthIdx = Math.max(0, Math.min(11, monthIdx));
        
        return {
            ...d,
            name: name,
            value: Math.abs(Number(d.value)) || 0,
            year: d.year || (d.date ? d.date.split("-")[0] : "2024"),
            monthIdx: monthIdx,
            month: months[monthIdx],
            genre: d.category || d.genre || d.type || "Other"
        };
    });

    // Group by month and take Top 10
    const grouped = d3.group(normalized, d => d.monthIdx);
    const finalData = [];
    const stats = { total: rawJson.length, showing: 0, truncatedPerMonth: {} };

    for (let m = 0; m < 12; m++) {
        const monthItems = grouped.get(m) || [];
        const sorted = monthItems.sort((a, b) => b.value - a.value);
        const topN = sorted.slice(0, 10);
        
        topN.forEach((d, i) => {
            const slug = d.name.replace(/\W/g, '').toLowerCase();
            d.id = `${m}_${slug}_${i}`;
            finalData.push(d);
        });
        
        if (sorted.length > 10) {
            stats.truncatedPerMonth[m] = sorted.length - 10;
        }
        stats.showing += topN.length;
    }

    // Add global ranks back to the final display set
    const rankSet = [...finalData].sort((a,b) => b.value - a.value);
    const rankMap = new Map();
    rankSet.forEach((d, i) => rankMap.set(d.id, i + 1));
    finalData.forEach(d => d.rank = rankMap.get(d.id));

    // Extract Dynamic Genres
    const uniqueGenres = Array.from(new Set(finalData.map(d => d.genre)));
    const activeGenres = uniqueGenres.length > 0 ? uniqueGenres : baseGenres;
    
    const genreColors = {};
    activeGenres.forEach((g, i) => {
        genreColors[g] = defaultGenreColors[i % defaultGenreColors.length];
    });

    return { data: finalData, stats: stats, genres: activeGenres, genreColors: genreColors };
}

function generateDummyData() {
    const data = [];
    let rank = 1;
    for (let m = 0; m < 12; m++) {
        const numMovies = Math.floor(Math.random() * 11) + 8; 
        for (let i = 0; i < numMovies; i++) {
            const isSpike = (m === 0 || m === 7 || m === 11) && Math.random() > 0.6;
            const value = isSpike ? Math.floor(Math.random() * 80) + 60 : Math.floor(Math.random() * 25) + 5;
            data.push({
                name: `Blockbuster ${rank}`, 
                year: Math.random() > 0.5 ? "2013" : "2014",
                value: value, 
                monthIdx: m, 
                genre: baseGenres[Math.floor(Math.random() * baseGenres.length)]
            });
            rank++;
        }
    }
    return sanitizeData(data);
}

function debounce(fn, ms) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => fn.apply(this, args), ms);
    };
}

function getResponsiveScale() {
    const w = window.innerWidth;
    if (w < 480) return 0.28; // Small mobile
    if (w < 768) return 0.38; // Mobile
    if (w < 1024) return 0.55; // Tablet
    if (w < 1440) return 0.75; // Laptop
    return 0.9; // Desktop
}

function App() {
  const [chartResult, setChartResult] = useState(() => {
    const saved = localStorage.getItem("saved_radial_data");
    try {
        if (saved) {
            const parsed = JSON.parse(saved);
            return sanitizeData(parsed);
        }
    } catch(e) { console.error("Could not load saved data", e); }
    return generateDummyData();
  });
  const chartData = chartResult.data;
  const chartStats = chartResult.stats;
  const genres = chartResult.genres;
  const genreColors = chartResult.genreColors;
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jsonError, setJsonError] = useState("");
  const initialZoom = getResponsiveScale();
  
  // Ref to communicate with d3 animation loop
  const cameraRef = useRef({
      targetZoomScale: initialZoom,
      currentZoomScale: initialZoom,
      currentRotX: 55,
      currentRotZ: 0,
      velX: 0,
      velZ: 0,
      autoRotate: true,
      needsReset: false,
  });

  const zoomIn = () => {
      cameraRef.current.targetZoomScale += 0.2;
      cameraRef.current.targetZoomScale = Math.min(cameraRef.current.targetZoomScale, 15);
  };

  const zoomOut = () => {
      cameraRef.current.targetZoomScale -= 0.2;
      cameraRef.current.targetZoomScale = Math.max(cameraRef.current.targetZoomScale, 0.1);
  };

  const resetCamera = () => {
      cameraRef.current.autoRotate = false;
      cameraRef.current.velX = 0;
      cameraRef.current.velZ = 0;
      cameraRef.current.currentRotX = 0;
      cameraRef.current.currentRotZ = 0;
      cameraRef.current.targetZoomScale = initialZoom;
      cameraRef.current.currentZoomScale = initialZoom;
      const orbitNode = document.getElementById("orbit-group");
      if (orbitNode) {
          orbitNode.style.transition = 'transform 0.8s cubic-bezier(0.2, 1, 0.3, 1)';
          orbitNode.style.transform = `translateZ(0) scale(${initialZoom}) rotateX(0deg) rotateZ(0deg)`;
          setTimeout(() => { orbitNode.style.transition = 'none'; }, 800);
      }
  };

  useEffect(() => {
    const data = chartData;
    const orbitNode = document.getElementById("orbit-group");
    const wrapperElem = document.getElementById("chart-wrapper");
    if (!orbitNode || !wrapperElem) return;

    // --- D3 LIFECYCLE & SCALE LOGIC ---
    const ringInnerRadius = 200;
    const ringOuterRadius = 230;
    const barStartRadius = 235;
    const barMaxRadius = 450;
    
    // Dynamic Genre Calculations
    const genreSpacing = 20;
    const totalGenreHeight = (chartResult.genres.length - 1) * genreSpacing;

    const orbitD3 = d3.select(orbitNode);
    orbitD3.selectAll("*").remove(); // Hard clear before rebuild
    
    const legendContainerNode = document.getElementById("legend-container");
    if (legendContainerNode) legendContainerNode.innerHTML = "";

    // Global Camera Init for new dataset
    cameraRef.current.autoRotate = true;

    // Dual-Scale System (Centered 85% allotment)
    const monthAngle = (2 * Math.PI) / 12;
    const paddingMultiplier = 0.85; 
    const usableAngle = monthAngle * paddingMultiplier;
    const angularOffset = (monthAngle - usableAngle) / 2;

    const dataByMonth = d3.group(data, d => d.monthIdx);
    const monthScales = {};

    for (let m = 0; m < 12; m++) {
        const monthItems = dataByMonth.get(m) || [];
        const start = m * monthAngle + angularOffset;
        const end = start + usableAngle;
        
        monthScales[m] = d3.scaleBand()
            .domain(monthItems.map(d => d.id))
            .range([start, end])
            .paddingInner(0.15);
    }

    const getXPos = (d) => {
        const scale = monthScales[d.monthIdx];
        return scale ? scale(d.id) : 0;
    };
    const getBandwidth = (d) => {
        const scale = monthScales[d.monthIdx];
        return scale ? scale.bandwidth() : 0.02;
    };

    // Y Scale with Dataset-Relative Labeling & Min Height Guard
    const maxVal = d3.max(data, d => d.value) || 1;
    const y = d3.scaleLinear().range([barStartRadius, barMaxRadius]).domain([0, maxVal]);
    const minHeight = (barMaxRadius - barStartRadius) * 0.03; // 3% proportional min height

    // Perceptual Color Intensity Clamping [0.4, 1.0]
    const getBarColor = (d) => {
        const baseColor = d3.color(monthColors[d.monthIdx]);
        const intensity = 0.4 + (d.value / maxVal) * 0.6;
        return d3.interpolateLab(d3.lab(baseColor).darker(1.5), baseColor)(intensity);
    };

    // Performance Guard: disable transitions for large datasets
    const disableTransitions = data.length > 80;
    const transitionDuration = disableTransitions ? 0 : 1200;

    // --- RENDER LAYERS ---
    function createLayer(z, className) {
        return orbitD3.append("svg")
            .attr("class", `layer-svg ${className}`)
            .attr("viewBox", `0 0 1200 1200`)
            .style("transform", `translate3d(0,0,${z}px)`)
            .append("g")
            .attr("transform", `translate(600,600)`);
    }

    const lGrid = createLayer(0, "layer-grid");
    const lHub = createLayer(5, "layer-hub");
    const lChords = createLayer(10, "layer-chords");
    const lExtrusions = Array.from({length: 4}, (_, i) => createLayer(10 + ((i+1) * 7.5), "layer-extrusion"));
    const lBarsTop = createLayer(45, "layer-bars-top");
    const lNodes = createLayer(48, "layer-nodes");
    const lLabels = createLayer(52, "layer-labels");
    const lInteract = createLayer(55, "layer-interact");

    // Grid Rings
    lGrid.selectAll("circle").data(y.ticks(5)).join("circle")
        .attr("r", d => y(d)).style("fill", "none").style("stroke", "#2a2a35").style("stroke-dasharray", "4,4").style("opacity", 0.6);

    // Month Skeleton (12 arcs)
    const monthArcs = Array.from({length: 12}, (_, i) => ({monthIdx: i}));
    lChords.selectAll(".month-skeleton").data(monthArcs).join("path")
        .attr("class", "month-skeleton pointer-events-none")
        .attr("fill", d => monthColors[d.monthIdx])
        .attr("opacity", 0.08)
        .attr("d", d3.arc().innerRadius(ringInnerRadius).outerRadius(ringOuterRadius).startAngle(d => d.monthIdx * monthAngle).endAngle(d => (d.monthIdx + 1) * monthAngle));

    // Placeholder Tags for Empty Months
    lInteract.selectAll(".empty-label").data(monthArcs.filter(m => !dataByMonth.has(m.monthIdx))).join("text")
        .attr("class", "empty-label text-[8px] fill-gray-600 font-bold uppercase")
        .attr("text-anchor", "middle")
        .attr("transform", d => {
            const angle = (d.monthIdx + 0.5) * monthAngle;
            const r = barStartRadius - 30;
            return `translate(${r * Math.sin(angle)}, ${-r * Math.cos(angle)}) rotate(${angle * 180 / Math.PI})`;
        })
        .text("No Data");

    // Bars Rendering using .join() and Perpetual IDs
    const renderBars = (selection, isTop = false) => {
        return selection.selectAll("path").data(data, d => d.id).join(
            enter => enter.append("path")
                .attr("class", d => `chart-element bar-${d.id} item-month-${d.monthIdx}`)
                .attr("d", d3.arc().innerRadius(barStartRadius).outerRadius(barStartRadius).startAngle(getXPos).endAngle(d => getXPos(d) + getBandwidth(d))),
            update => update,
            exit => exit.transition().duration(500).attr("opacity", 0).remove()
        ).transition().duration(transitionDuration).delay((d, i) => disableTransitions ? 0 : Math.min(i * 5, 400))
         .attr("fill", d => isTop ? getBarColor(d) : d3.color(getBarColor(d)).darker(1.5))
         .attr("d", d3.arc().innerRadius(barStartRadius).outerRadius(d => Math.max(barStartRadius + minHeight, y(d.value))).startAngle(getXPos).endAngle(d => getXPos(d) + getBandwidth(d)));
    };

    lExtrusions.forEach(layer => renderBars(layer));
    renderBars(lBarsTop, true);

    // Top Glowing Nodes
    lNodes.selectAll("circle").data(data, d => d.id).join("circle")
        .attr("class", d => `chart-element bar-node bar-${d.id}`)
        .attr("fill", d => monthColors[d.monthIdx])
        .attr("filter", "url(#glow)")
        .attr("r", 0)
        .attr("cx", d => { const a = getXPos(d) + getBandwidth(d)/2; return barStartRadius * Math.sin(a); })
        .attr("cy", d => { const a = getXPos(d) + getBandwidth(d)/2; return -barStartRadius * Math.cos(a); })
        .transition().duration(transitionDuration).delay((d, i) => disableTransitions ? 0 : Math.min(i * 5, 400) + 100)
        .attr("r", 2.5)
        .attr("cx", d => { 
            const a = getXPos(d) + getBandwidth(d)/2; 
            const radius = Math.max(barStartRadius + minHeight, y(d.value));
            return radius * Math.sin(a); 
        })
        .attr("cy", d => { 
            const a = getXPos(d) + getBandwidth(d)/2; 
            const radius = Math.max(barStartRadius + minHeight, y(d.value));
            return -radius * Math.cos(a); 
        });

    // Radial Labels
    lLabels.selectAll(".bar-label").data(data, d => d.id).join("text")
        .attr("class", d => `chart-element bar-label bar-${d.id} text-[7px] font-bold fill-gray-400 pointer-events-none`)
        .attr("opacity", 0)
        .attr("transform", d => {
            const angle = (getXPos(d) + getBandwidth(d)/2);
            return `rotate(${(angle * 180 / Math.PI) - 90}) translate(${barStartRadius + 10})`;
        })
        .text(d => `[${d.year}] ${d.name.length > 20 ? d.name.slice(0, 18) + ".." : d.name}`)
        .transition().duration(transitionDuration).delay((d, i) => disableTransitions ? 0 : Math.min(i * 5, 400) + 200)
        .attr("opacity", 1)
        .attr("transform", d => {
            const angleRad = (getXPos(d) + getBandwidth(d)/2);
            const angleDeg = (angleRad * 180 / Math.PI);
            const r = Math.max(barStartRadius + minHeight, y(d.value)) + 8;
            // Adjustment for text orientation based on angle
            const rotateAdjust = (angleDeg > 90 && angleDeg < 270) ? 180 : 0;
            const anchor = (angleDeg > 90 && angleDeg < 270) ? "end" : "start";
            d.anchor = anchor; // Save for later
            return `rotate(${angleDeg - 90}) translate(${r}) rotate(${rotateAdjust})`;
        })
        .attr("text-anchor", d => ( (getXPos(d) + getBandwidth(d)/2) * 180 / Math.PI > 90 && (getXPos(d) + getBandwidth(d)/2) * 180 / Math.PI < 270 ) ? "end" : "start");

    // Chords Logic
    const lineGenerator = d3.line().curve(d3.curveBundle.beta(0.85));
    const genreNodes = {};
    genres.forEach((g, i) => {
        // Correctly calculate dynamic genre heights for chord mapping
        genreNodes[g] = { x: -35, y: (-totalGenreHeight/2) + (i * genreSpacing) - 2 };
    });

    lChords.selectAll(".chord-line").data(data, d => d.id).join("path")
        .attr("class", d => `chart-element chord-line chord-${d.id} item-month-${d.monthIdx}`)
        .attr("fill", "none").attr("stroke", d => monthColors[d.monthIdx]).attr("stroke-width", "0.2px").attr("opacity", 0.15)
        .attr("d", d => {
            const angle = getXPos(d) + getBandwidth(d) / 2;
            const tx = ringInnerRadius * Math.sin(angle);
            const ty = -ringInnerRadius * Math.cos(angle);
            const start = genreNodes[d.genre] || {x:0, y:0};
            return lineGenerator([[start.x, start.y], [0, 0], [tx, ty]]);
        });

    // Interaction Overlays
    lInteract.selectAll(".hitbox").data(data, d => d.id).join("path")
        .attr("class", "cursor-pointer")
        .attr("fill", "transparent")
        .attr("d", d3.arc().innerRadius(barStartRadius).outerRadius(barMaxRadius + 60).startAngle(getXPos).endAngle(d => getXPos(d) + getBandwidth(d)))
        .on("mouseover", (event, d) => { if (window.innerWidth > 768) handleMouseOver(event, d); })
        .on("mouseout", (event, d) => { if (window.innerWidth > 768) handleMouseOut(); })
        .on("click", handleClick);

    // CENTRAL HUB ENHANCEMENT
    const centerHub = lHub.append("g").attr("class", "center-hub");
    
    // Core Pulse
    centerHub.append("circle")
        .attr("class", "core-pulse")
        .attr("r", 15)
        .attr("fill", "#00e5ff")
        .attr("filter", "url(#glow)");

    centerHub.append("circle")
        .attr("r", 90)
        .attr("fill", "#0a0a0f")
        .attr("stroke", "rgba(0,229,255,0.05)")
        .attr("stroke-width", 1);
    
    // CENTRAL HUB ENHANCEMENT
    const genreList = centerHub.append("g").attr("class", "genre-labels").attr("transform", `translate(-75, ${-totalGenreHeight / 2})`);
    
    genres.forEach((g, i) => {
        const row = genreList.append("g").attr("transform", `translate(0, ${i * genreSpacing})`);
        row.append("text")
            .attr("fill", genreColors[g])
            .attr("font-size", "11px")
            .attr("font-weight", "800")
            .attr("text-anchor", "start")
            .attr("class", "cursor-default opacity-80")
            .text(g.toUpperCase());
    });

    const infoHub = centerHub.append("g").attr("class", "info-hub-content").style("opacity", 0);
    // Use a semi-transparent background to let the genres/pulse peek through
    infoHub.append("circle").attr("r", 90).attr("fill", "rgba(10, 10, 15, 0.92)").style("backdrop-filter", "blur(4px)");
    
    infoHub.append("text").attr("y", 78).attr("fill", "#475569").attr("font-size", "7px").attr("font-weight", "bold").attr("text-anchor", "middle")
        .text(`SCALED TO DATASET MAX: ${maxVal.toLocaleString()}M`);

    const hubContent = infoHub.append("g").attr("transform", "translate(0, -15)");
    const hubTitle = hubContent.append("text").attr("fill", "#fff").attr("font-size", "14px").attr("font-weight", "bold").attr("text-anchor", "middle");
    const hubRank = hubContent.append("text").attr("y", 18).attr("fill", "#94a3b8").attr("font-size", "10px").attr("text-anchor", "middle");
    const hubValue = hubContent.append("text").attr("y", 45).attr("fill", "#fff").attr("font-size", "24px").attr("font-weight", "800").attr("text-anchor", "middle").attr("class", "pulse-text");

    const tooltip = d3.select("#tooltip");
    let lockedData = null;

    function highlightElement(d) {
        d3.selectAll(".chart-element").classed("chart-dimmed", true);
        d3.selectAll(`.bar-${d.id}`).classed("chart-dimmed", false).classed("chart-highlight", true);
        d3.select(`.chord-${d.id}`).classed("chart-dimmed", false).classed("highlight-line", true);
    }

    function handleMouseOver(event, d) {
        if (lockedData || isDragging) return;
        highlightElement(d);
        tooltip.transition().duration(100).style("opacity", 1);
        
        const truncationMsg = chartStats.truncatedPerMonth[d.monthIdx] ? `<div class="mt-2 text-[10px] text-cyan-400 font-bold border-t border-cyan-800 pt-2 italic">Showing Top 10 (${chartStats.truncatedPerMonth[d.monthIdx]} others hidden for this month)</div>` : "";

        tooltip.html(`
            <div class="font-bold flex items-center gap-2 text-sm border-b border-gray-700 pb-2 mb-2">
                <span class="w-3 h-3 rounded-full" style="background:${monthColors[d.monthIdx]}"></span>
                [${d.year}] ${d.name}
            </div>
            <div class="grid grid-cols-2 text-xs gap-y-1">
                <span class="text-gray-400 text-left">Internal Rank</span> <span class="font-bold text-white text-right">#${d.rank}</span>
                <span class="text-gray-400 text-left">Value</span> <span class="font-bold text-white text-right">${d.value.toLocaleString()}M</span>
            </div>
            ${truncationMsg}
        `);
    }

    const onGlobalMouseMove = (e) => {
        if (!lockedData && !isDragging) tooltip.style("left", (e.pageX + 15) + "px").style("top", (e.pageY - 15) + "px");
    };
    window.addEventListener("mousemove", onGlobalMouseMove);

    function handleMouseOut() { if (!lockedData && !isDragging) resetHighlight(); }

    function handleClick(event, d) {
        event.stopPropagation();
        if (lockedData && lockedData.id === d.id) {
            unlockAll();
        } else {
            lockedData = d;
            highlightElement(d);
            hubTitle.text(d.name.length > 20 ? d.name.slice(0,18) + "..." : d.name);
            hubRank.text(`#${d.rank} | Month: ${months[d.monthIdx]} | ${d.genre}`);
            hubValue.text(`${d.value.toLocaleString()}M`).attr("fill", monthColors[d.monthIdx]);
            infoHub.transition().duration(200).style("opacity", 1);
            
            if (window.innerWidth <= 768) {
               // Mobile "tap to focus" also shows tooltip relative to the tap
               handleMouseOver(event, d);
               tooltip.style("left", (event.pageX) + "px").style("top", (event.pageY - 80) + "px");
            } else {
               tooltip.style("opacity", 0);
            }
        }
    }

    function resetHighlight() {
        d3.selectAll(".chart-element").classed("chart-dimmed", false).classed("chart-highlight", false);
        d3.selectAll(".chord-line").classed("highlight-line", false);
        tooltip.style("opacity", 0);
    }

    function unlockAll() {
        lockedData = null;
        infoHub.transition().duration(200).style("opacity", 0);
        resetHighlight();
    }

    // --- CAMERA & INTERACTION LOGIC (RESTORED) ---
    let isDragging = false;
    let lastX, lastY;
    let initialPinchDistance = null;
    let initialPinchZoom = null;
    const friction = 0.92;
    const sensitivity = 0.12;

    function updateTransform() {
        if (orbitNode.style.transition === 'none' || !orbitNode.style.transition) {
             orbitNode.style.transform = `translateZ(0) scale(${cameraRef.current.currentZoomScale}) rotateX(${cameraRef.current.currentRotX}deg) rotateZ(${cameraRef.current.currentRotZ}deg)`;
        }
    }

    let animationId;
    function animate() {
        let cam = cameraRef.current;
        if (cam.autoRotate && !isDragging) cam.velZ = -0.06;
        cam.currentRotX += cam.velX;
        cam.currentRotZ += cam.velZ;
        if (!isDragging) { cam.velX *= friction; cam.velZ *= friction; }
        cam.currentZoomScale += (cam.targetZoomScale - cam.currentZoomScale) * 0.1;

        if (Math.abs(cam.velX) > 0.01 || Math.abs(cam.velZ) > 0.01 || Math.abs(cam.targetZoomScale - cam.currentZoomScale) > 0.005 || cam.autoRotate) {
            updateTransform();
        }
        animationId = requestAnimationFrame(animate);
    }
    animationId = requestAnimationFrame(animate);

    const onWheel = (e) => {
        e.preventDefault(); cameraRef.current.autoRotate = false;
        cameraRef.current.targetZoomScale = Math.max(0.1, Math.min(cameraRef.current.targetZoomScale + e.deltaY * -0.0015, 15));
    };
    const onMouseDown = (e) => { isDragging = true; cameraRef.current.autoRotate = false; lastX = e.clientX; lastY = e.clientY; };
    const onTouchStart = (e) => {
        cameraRef.current.autoRotate = false;
        if (e.touches.length === 1) { isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY; }
        else if (e.touches.length === 2) { initialPinchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); initialPinchZoom = cameraRef.current.targetZoomScale; }
    };
    const onMouseMove = (e) => {
        if (!isDragging) return;
        const dx = e.clientX - lastX; const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        const inv = Math.cos(cameraRef.current.currentRotX * Math.PI / 180) < 0 ? -1 : 1;
        cameraRef.current.velZ += dx * sensitivity * inv; cameraRef.current.velX -= dy * sensitivity;
    };
    const onTouchMove = (e) => {
        if (e.touches.length === 1 && isDragging) {
            const dx = e.touches[0].clientX - lastX; const dy = e.touches[0].clientY - lastY;
            lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
            const inv = Math.cos(cameraRef.current.currentRotX * Math.PI / 180) < 0 ? -1 : 1;
            cameraRef.current.velZ += dx * sensitivity * 0.6 * inv; cameraRef.current.velX -= dy * sensitivity * 0.6;
        } else if (e.touches.length === 2 && initialPinchDistance) {
            const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
            cameraRef.current.targetZoomScale = Math.max(0.1, Math.min(initialPinchZoom * (dist / initialPinchDistance), 15));
        }
        if (e.cancelable) e.preventDefault();
    };
    const onRelease = () => { isDragging = false; initialPinchDistance = null; };

    const resizeObserver = new ResizeObserver(debounce(() => {
        cameraRef.current.targetZoomScale = getResponsiveScale();
    }, 150));
    resizeObserver.observe(wrapperElem);

    wrapperElem.addEventListener("wheel", onWheel, { passive: false });
    wrapperElem.addEventListener("mousedown", onMouseDown);
    wrapperElem.addEventListener("touchstart", onTouchStart, { passive: false });
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("mouseup", onRelease);
    window.addEventListener("touchend", onRelease);
    wrapperElem.addEventListener("click", e => { if (e.target.tagName !== 'path') unlockAll(); });

    // --- LEGEND RENDERING ---
    const legendContainer = d3.select("#legend-container");
    months.forEach((month, i) => {
        const monthItems = data.filter(d => d.monthIdx === i).sort((a,b) => b.value - a.value);
        const topItem = monthItems[0];
        const title = topItem ? topItem.name : `Month ${i+1}`;
        const truncCount = chartStats.truncatedPerMonth[i] || 0;

        const item = legendContainer.append("div")
            .attr("class", "flex flex-col items-center cursor-pointer transition-transform hover:-translate-y-2 min-w-[65px] group")
            .on("mouseover", function() {
                if (lockedData) return;
                d3.selectAll(".chart-element").classed("chart-dimmed", true);
                d3.selectAll(`.item-month-${i}`).classed("chart-dimmed", false);
                d3.selectAll(`.chord-line.item-month-${i}`).classed("highlight-line", true);
            })
            .on("mouseout", () => { if(!lockedData) resetHighlight(); });
        
        item.append("div").attr("class", "legend-title text-[9px] text-gray-400 group-hover:text-white transition-colors")
            .style("white-space", "nowrap").text(title.length > 10 ? title.slice(0,8)+".." : title);
        
        item.append("div").attr("class", "w-8 h-4 rounded-sm my-1").style("background-color", monthColors[i]);
        
        const footer = item.append("div").attr("class", "flex items-center gap-1 text-[9px] font-bold");
        footer.append("span").attr("class", "text-gray-500").text(`${month}M`);
        if (truncCount > 0) {
            footer.append("span").attr("class", "text-cyan-500/60").text(`+${truncCount}`);
        }
    });

    return () => {
        cancelAnimationFrame(animationId);
        resizeObserver.disconnect();
        wrapperElem.removeEventListener("wheel", onWheel);
        wrapperElem.removeEventListener("mousedown", onMouseDown);
        wrapperElem.removeEventListener("touchstart", onTouchStart);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("touchmove", onTouchMove);
        window.removeEventListener("mouseup", onRelease);
        window.removeEventListener("touchend", onRelease);
        window.removeEventListener("mousemove", onGlobalMouseMove);
    };
  }, [chartData]);

  const resetToDemo = () => {
    localStorage.removeItem("saved_radial_data");
    setChartResult(generateDummyData());
  };

  const processFile = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.json') && file.type !== 'application/json') {
      setJsonError("Please upload a valid .json file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const result = sanitizeData(json);
        if (result.data.length > 0) {
          setChartResult(result);
          localStorage.setItem("saved_radial_data", JSON.stringify(json));
          setIsModalOpen(false);
          setJsonError("");
        } else {
            setJsonError("No valid data found in JSON. Ensure items have a 'value' property.");
        }
      } catch (err) {
        setJsonError("Error parsing JSON file. Please check format.");
      }
    };
    reader.readAsText(file);
  };

  const handleFileUpload = (e) => {
    processFile(e.target.files[0]);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const dummyJsonExample = `[
  {
    "name": "My Custom Data 1",
    "value": 120,
    "year": "2024",
    "month": "1",
    "monthIdx": 0,
    "genre": "Action"
  }
]`;

  return (
    <div className="min-h-screen flex flex-col selection:bg-indigo-500 selection:text-white relative" style={{ background: "radial-gradient(circle at center, #0f0f13 0%, #060606 100%)" }}>
      <svg style={{ width: 0, height: 0, position: "absolute" }} aria-hidden="true" focusable="false">
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      <div id="tooltip"></div>

      {/* Main Chart Wrapper */}
      <div className="relative w-full h-[80vh] flex items-center justify-center overflow-hidden" id="chart-wrapper">
        <div id="orbit-group"></div>
        
        {/* Floating Tooltips and Controls container - Responsive */}
        <div className="absolute top-4 left-4 md:top-6 md:left-10 pointer-events-none flex flex-col gap-2 z-10 w-48 md:w-auto">
          <div className="flex items-center gap-2 md:gap-3 bg-black/40 backdrop-blur-md px-2 md:px-4 py-2 rounded-xl md:rounded-full border border-white/10">
            <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Hover & Click Data Nodes</span>
          </div>
          <div className="flex items-center gap-2 md:gap-3 bg-black/40 backdrop-blur-md px-2 md:px-4 py-2 rounded-xl md:rounded-full border border-white/10 hidden md:flex">
            <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"></path></svg>
            <span className="text-[10px] md:text-xs text-gray-300 font-medium">Click & Drag to Rotate 3D Space</span>
          </div>
          <button onClick={resetCamera} className="flex items-center gap-2 md:gap-3 bg-black/60 backdrop-blur-md px-2 md:px-4 py-2 rounded-xl md:rounded-full border border-white/10 pointer-events-auto hover:bg-white/10 transition-colors text-left cursor-pointer group mt-2">
            <svg className="w-3 h-3 md:w-4 md:h-4 text-gray-400 group-hover:text-cyan-400 transition-colors shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
            <span className="text-[10px] md:text-xs text-gray-300 font-medium group-hover:text-white transition-colors">Snap to 2D Image View</span>
          </button>
        </div>

        {/* Right side floating controls (Zoom & Upload) */}
        <div className="absolute top-4 right-4 md:top-6 md:right-10 flex flex-col gap-3 z-10 items-end">
             <div className="flex flex-col gap-3">
                 <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 shadow-lg shadow-cyan-500/20 px-4 py-2 rounded-full border border-white/20 pointer-events-auto transition text-white font-semibold text-xs md:text-sm shadow-[0_0_15px_rgba(0,229,255,0.3)] hover:scale-105 active:scale-95">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                    Upload Data
                 </button>
                 <button onClick={resetToDemo} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-1.5 rounded-full border border-white/10 pointer-events-auto transition text-gray-400 hover:text-white text-[10px] md:text-xs">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Reset to Demo
                 </button>
             </div>

             {/* Zoom Controls for Mobile/Desktop Touch */}
             <div className="flex flex-col gap-2 mt-4 hidden md:flex">
                 <button onClick={zoomIn} className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center pointer-events-auto hover:bg-white/10 transition hover:text-cyan-400 text-gray-300 shadow-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                 </button>
                 <button onClick={zoomOut} className="w-10 h-10 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center pointer-events-auto hover:bg-white/10 transition hover:text-cyan-400 text-gray-300 shadow-lg">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                 </button>
             </div>
             
             {/* Simpler zoom control for mobile */}
             <div className="flex md:hidden gap-2 mt-2 pointer-events-auto">
                 <button onClick={zoomOut} className="w-8 h-8 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition hover:text-cyan-400 text-gray-300 shadow-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 12H4"></path></svg>
                 </button>
                 <button onClick={zoomIn} className="w-8 h-8 bg-black/60 backdrop-blur-md rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition hover:text-cyan-400 text-gray-300 shadow-lg">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
                 </button>
             </div>
        </div>
      </div>

      <div className="w-full max-w-[1400px] mx-auto px-4 md:px-10 pb-12 flex flex-col lg:flex-row justify-between items-center lg:items-end gap-10">
        <div className="max-w-xl z-10 relative hidden lg:block"></div>
        <div className="flex flex-col items-center lg:items-end z-10 relative pointer-events-none w-full">
          <div id="legend-container" className="flex items-end gap-[2px] md:gap-1 mb-2 pointer-events-auto overflow-x-auto max-w-full pb-4 scrollbar-hide" style={{ msOverflowStyle: 'none', scrollbarWidth: 'none' }}></div>
          <p className="text-[10px] md:text-[11px] text-gray-400 tracking-wide text-center lg:text-right">
            [Monthly Color Index & Top Grossing Movie/Data]
            <span className="block mt-1 text-cyan-400/80 font-bold uppercase tracking-widest text-[9px]">
              Displaying Top 10 items per month ({chartStats.total} total items in dataset)
            </span>
          </p>
        </div>
      </div>

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-[#111116] border border-white/10 rounded-2xl p-6 md:p-8 w-full max-w-md shadow-2xl relative transition-all">
                <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
                <h2 className="text-xl font-bold text-white mb-2">Upload Custom Dataset</h2>
                <p className="text-xs text-gray-400 mb-6">Select a JSON file containing an array of objects to visualize in 3D.</p>
                
                <div 
                    className="border border-dashed border-cyan-500/50 bg-cyan-900/10 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-cyan-900/20 transition group"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                >
                    <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" id="json-upload" />
                    <label htmlFor="json-upload" className="cursor-pointer flex flex-col items-center w-full h-full">
                        <svg className="w-10 h-10 text-cyan-400 mb-3 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                        <span className="text-cyan-300 font-medium">Click to browse or drag file</span>
                        <span className="text-[10px] text-gray-500 mt-1">.json files only</span>
                    </label>
                </div>

                {jsonError && <div className="mt-4 text-red-400 text-xs text-center p-2 bg-red-900/20 rounded border border-red-500/30">{jsonError}</div>}

                <div className="mt-6 bg-black/40 rounded-lg p-4">
                    <div className="text-[10px] text-gray-400 font-semibold mb-2">EXPECTED JSON FORMAT:</div>
                    <pre className="text-[10px] text-cyan-200/70 overflow-x-auto p-2 bg-black/50 rounded inline-block w-full">
                        {dummyJsonExample}
                    </pre>
                </div>
            </div>
        </div>
      )}

    </div>
  );
}

export default App;
