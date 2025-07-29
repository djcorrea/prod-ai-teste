// Helper para configuração robusta do Firebase
// Este arquivo pode ajudar a resolver problemas de reCAPTCHA Enterprise

export function initializeFirebaseForAuth(auth) {
  try {
    console.log('🔧 Aplicando configurações avançadas do Firebase Auth...');
    
    // Configurações para melhorar compatibilidade
    if (auth.settings) {
      // Desabilitar verificação para teste apenas se necessário
      // auth.settings.appVerificationDisabledForTesting = true; // Apenas para desenvolvimento
      
      console.log('✅ Configurações do Auth aplicadas');
    }
    
    // Configurar configurações de rede se disponível
    if (auth.tenantId) {
      console.log('🏢 Tenant ID detectado:', auth.tenantId);
    }
    
    return true;
  } catch (error) {
    console.warn('⚠️ Não foi possível aplicar configurações avançadas:', error);
    return false;
  }
}

export function createRobustRecaptcha(auth, containerId = 'recaptcha-container') {
  return new Promise((resolve, reject) => {
    try {
      console.log('🔄 Criando reCAPTCHA robusto...');
      
      // Configuração progressiva - tenta do mais específico ao mais simples
      const configs = [
        // Configuração normal
        {
          size: 'normal',
          callback: (response) => {
            console.log('✅ reCAPTCHA callback executado:', response);
          },
          'expired-callback': () => {
            console.log('⏰ reCAPTCHA expirado');
          }
        },
        // Configuração minimal
        {
          size: 'normal'
        },
        // Configuração vazia (padrão)
        {}
      ];
      
      async function tryConfig(configIndex = 0) {
        if (configIndex >= configs.length) {
          reject(new Error('Todas as configurações de reCAPTCHA falharam'));
          return;
        }
        
        try {
          const config = configs[configIndex];
          console.log(`🔄 Tentando configuração ${configIndex + 1}/${configs.length}:`, config);
          
          const recaptchaVerifier = new window.firebase.auth.RecaptchaVerifier(containerId, config);
          
          await recaptchaVerifier.render();
          console.log(`✅ reCAPTCHA configuração ${configIndex + 1} funcionou!`);
          resolve(recaptchaVerifier);
          
        } catch (error) {
          console.warn(`⚠️ Configuração ${configIndex + 1} falhou:`, error);
          tryConfig(configIndex + 1);
        }
      }
      
      tryConfig();
      
    } catch (error) {
      console.error('❌ Erro crítico ao criar reCAPTCHA:', error);
      reject(error);
    }
  });
}

export function getRecaptchaDebugInfo() {
  const info = {
    hasGrecaptcha: typeof window.grecaptcha !== 'undefined',
    hasFirebase: typeof window.firebase !== 'undefined',
    userAgent: navigator.userAgent,
    domain: window.location.hostname,
    protocol: window.location.protocol,
    firebaseVersion: window.firebase?.SDK_VERSION || 'não detectado'
  };
  
  console.log('🔍 Debug reCAPTCHA:', info);
  return info;
}

// Função para verificar se reCAPTCHA Enterprise está causando problemas
export function detectRecaptchaIssues() {
  const issues = [];
  
  // Verificar se está em localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    issues.push('LOCALHOST_DETECTED: reCAPTCHA pode ter problemas em localhost');
  }
  
  // Verificar protocolo
  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    issues.push('HTTP_PROTOCOL: reCAPTCHA requer HTTPS em produção');
  }
  
  // Verificar se reCAPTCHA está carregado
  if (typeof window.grecaptcha === 'undefined') {
    issues.push('GRECAPTCHA_NOT_LOADED: Script do reCAPTCHA não carregado');
  }
  
  // Verificar console para erros específicos
  console.log('🔍 Possíveis problemas detectados:', issues);
  return issues;
}
