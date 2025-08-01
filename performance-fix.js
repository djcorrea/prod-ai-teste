// OTIMIZAÇÃO EMERGENCIAL - PROD.AI
// Aplicar estas mudanças IMEDIATAMENTE para resolver travamentos

/* ============ 1. PRIMEIRO: SUBSTITUA AS IMAGENS! ============ */
// Você DEVE baixar as imagens comprimidas e substituir:
// robo 2.png (2.98MB) -> robo-2-compressed.webp (~300KB)
// caixas.png (2.16MB) -> caixas-compressed.webp (~200KB)
// mesa.png (2.07MB) -> mesa-compressed.webp (~200KB)
// robo.png (1.95MB) -> robo-compressed.webp (~180KB)
// fundo.jpg (1.40MB) -> fundo-compressed.webp (~140KB)

/* ============ 2. DESABILITAR VANTA.JS EM MOBILE ============ */
function initVantaBackground() {
    try {
        // 🔥 APENAS em desktop para evitar travamento
        if (window.innerWidth <= 768) {
            console.log('📱 Mobile detectado - Vanta.js desabilitado para performance');
            return;
        }
        
        const vantaElement = document.getElementById("vanta-bg");
        if (!vantaElement) return;
        
        if (typeof VANTA !== 'undefined' && typeof THREE !== 'undefined') {
            vantaEffect = VANTA.NET({
                el: "#vanta-bg",
                mouseControls: false, // ⚡ Desabilitar controles mouse
                touchControls: false, // ⚡ Desabilitar controles touch
                gyroControls: false,
                minHeight: 200.00,
                minWidth: 200.00,
                scale: 1.00,
                scaleMobile: 0.50, // ⚡ Reduzir escala mobile
                color: 0x8a2be2,
                backgroundColor: 0x0a0a1a,
                points: 4.00, // ⚡ Reduzir pontos de 8 para 4
                maxDistance: 15.00, // ⚡ Reduzir distância
                spacing: 25.00, // ⚡ Aumentar espaçamento
                showDots: false // ⚡ Desabilitar pontos
            });
        }
    } catch (error) {
        console.warn('Vanta.js desabilitado por erro:', error);
    }
}

/* ============ 3. LAZY LOADING DAS IMAGENS ============ */
function implementLazyLoading() {
    const images = document.querySelectorAll('.cenario img');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                if (img.dataset.src) {
                    img.src = img.dataset.src;
                    img.removeAttribute('data-src');
                    observer.unobserve(img);
                }
            }
        });
    });

    images.forEach(img => {
        imageObserver.observe(img);
    });
}

/* ============ 4. REMOVER CONSOLE.LOGS EM PRODUÇÃO ============ */
if (window.location.hostname !== 'localhost') {
    console.log = () => {};
    console.warn = () => {};
    console.info = () => {};
}

/* ============ 5. THROTTLE NO RESIZE ============ */
let resizeTimeout;
function handleResize() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        const newIsDesktop = window.innerWidth > 768;
        
        if (newIsDesktop !== isDesktop) {
            isDesktop = newIsDesktop;
            
            // ⚡ Destruir Vanta apenas se existir
            if (vantaEffect) {
                vantaEffect.destroy();
                vantaEffect = null;
            }
            
            // ⚡ Recriar apenas em desktop
            if (isDesktop) {
                setTimeout(initVantaBackground, 100);
            }
        }
    }, 250); // ⚡ Throttle de 250ms
}

/* ============ 6. PRELOAD DAS IMAGENS CRÍTICAS ============ */
function preloadCriticalImages() {
    const criticalImages = [
        'robo-compressed.webp',
        'mesa-compressed.webp'
    ];
    
    criticalImages.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
    });
}

/* ============ 7. FALLBACK SEM EFEITOS ============ */
function enablePerformanceMode() {
    // Desabilitar todas as animações pesadas
    document.body.classList.add('performance-mode');
    
    // CSS para performance mode
    const style = document.createElement('style');
    style.textContent = `
        .performance-mode * {
            animation-duration: 0.01ms !important;
            animation-delay: 0.01ms !important;
            transition-duration: 0.01ms !important;
            transition-delay: 0.01ms !important;
        }
        
        .performance-mode .vanta-background {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}

/* ============ APLICAR OTIMIZAÇÕES ============ */
document.addEventListener('DOMContentLoaded', () => {
    // Detectar dispositivos fracos
    const isLowEndDevice = navigator.hardwareConcurrency < 4 || 
                          navigator.deviceMemory < 4;
    
    if (isLowEndDevice || window.innerWidth <= 768) {
        enablePerformanceMode();
        console.log('🚀 Modo performance ativado');
    }
    
    preloadCriticalImages();
    implementLazyLoading();
});

// Substituir listener de resize
window.removeEventListener('resize', handleResize);
window.addEventListener('resize', handleResize, { passive: true });
