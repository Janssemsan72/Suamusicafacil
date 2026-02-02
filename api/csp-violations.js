/**
 * API endpoint para receber relatórios de violações de CSP
 * Este endpoint coleta e armazena violações de CSP para análise
 */

export default async function handler(req, res) {
    // Apenas aceitar POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { violations, timestamp } = req.body;

        if (!violations || !Array.isArray(violations)) {
            return res.status(400).json({ error: 'Invalid violations data' });
        }

        // Log das violações (em produção, você pode querer salvar em um banco de dados)
        console.log('🔒 CSP Violations Report:', {
            timestamp,
            count: violations.length,
            violations: violations.map(v => ({
                type: v.type,
                violatedDirective: v.violatedDirective,
                blockedURI: v.blockedURI,
                sourceFile: v.sourceFile,
                message: v.message
            }))
        });

        // Análise das violações mais comuns
        const analysis = analyzeViolations(violations);
        
        // Em produção, você pode querer:
        // 1. Salvar no banco de dados
        // 2. Enviar alertas por email
        // 3. Integrar com serviços de monitoramento
        // 4. Gerar relatórios automáticos

        return res.status(200).json({
            success: true,
            received: violations.length,
            analysis,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Erro ao processar violações de CSP:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            message: error.message 
        });
    }
}

function analyzeViolations(violations) {
    const analysis = {
        total: violations.length,
        byType: {},
        byDirective: {},
        bySource: {},
        commonViolations: [],
        recommendations: []
    };

    violations.forEach(violation => {
        // Por tipo
        analysis.byType[violation.type] = (analysis.byType[violation.type] || 0) + 1;
        
        // Por diretiva violada
        if (violation.violatedDirective) {
            analysis.byDirective[violation.violatedDirective] = 
                (analysis.byDirective[violation.violatedDirective] || 0) + 1;
        }
        
        // Por fonte
        if (violation.sourceFile) {
            const source = violation.sourceFile.split('/').pop();
            analysis.bySource[source] = (analysis.bySource[source] || 0) + 1;
        }
    });

    // Identificar violações mais comuns
    const sortedDirectives = Object.entries(analysis.byDirective)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);

    analysis.commonViolations = sortedDirectives.map(([directive, count]) => ({
        directive,
        count,
        percentage: Math.round((count / analysis.total) * 100)
    }));

    // Gerar recomendações baseadas nas violações
    analysis.recommendations = generateRecommendations(analysis);

    return analysis;
}

function generateRecommendations(analysis) {
    const recommendations = [];

    // Recomendações baseadas nas diretivas mais violadas
    if (analysis.byDirective['script-src']) {
        recommendations.push({
            type: 'script-src',
            message: 'Considere adicionar domínios específicos ao script-src ou usar nonces',
            priority: 'high'
        });
    }

    if (analysis.byDirective['style-src']) {
        recommendations.push({
            type: 'style-src',
            message: 'Considere usar nonces para estilos inline ou mover para arquivos CSS',
            priority: 'medium'
        });
    }

    if (analysis.byDirective['img-src']) {
        recommendations.push({
            type: 'img-src',
            message: 'Adicione domínios de imagem necessários ao img-src',
            priority: 'medium'
        });
    }

    if (analysis.byDirective['connect-src']) {
        recommendations.push({
            type: 'connect-src',
            message: 'Adicione APIs externas necessárias ao connect-src',
            priority: 'high'
        });
    }

    // Recomendações gerais
    if (analysis.total > 10) {
        recommendations.push({
            type: 'general',
            message: 'Muitas violações detectadas - considere revisar a política de CSP',
            priority: 'high'
        });
    }

    return recommendations;
}
