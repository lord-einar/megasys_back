/**
 * Detector de cambios en informes de visitas
 * Compara el estado anterior con el nuevo y genera un objeto detallado de cambios
 */

/**
 * Compara dos arrays y detecta elementos agregados y eliminados
 */
function compararArrays(arrayAnterior = [], arrayNuevo = []) {
    const agregados = arrayNuevo.filter(item => !arrayAnterior.includes(item));
    const eliminados = arrayAnterior.filter(item => !arrayNuevo.includes(item));

    return {
        agregados,
        eliminados,
        total_antes: arrayAnterior.length,
        total_despues: arrayNuevo.length
    };
}

/**
 * Compara checklist items (array de objetos con nombre y completado)
 */
function compararChecklist(checklistAnterior = [], checklistNuevo = []) {
    const cambios = [];

    checklistNuevo.forEach(itemNuevo => {
        const itemAnterior = checklistAnterior.find(i => i.nombre === itemNuevo.nombre);

        if (!itemAnterior) {
            // Item nuevo agregado
            cambios.push({
                tipo: 'agregado',
                nombre: itemNuevo.nombre,
                completado: itemNuevo.completado
            });
        } else if (itemAnterior.completado !== itemNuevo.completado) {
            // Item modificado (cambió el estado)
            cambios.push({
                tipo: 'modificado',
                nombre: itemNuevo.nombre,
                antes: itemAnterior.completado,
                despues: itemNuevo.completado
            });
        }
    });

    // Items eliminados
    checklistAnterior.forEach(itemAnterior => {
        const existe = checklistNuevo.find(i => i.nombre === itemAnterior.nombre);
        if (!existe) {
            cambios.push({
                tipo: 'eliminado',
                nombre: itemAnterior.nombre,
                estaba_completado: itemAnterior.completado
            });
        }
    });

    return cambios;
}

/**
 * Compara problemas resueltos (array de objetos)
 */
function compararProblemas(problemasAnteriores = [], problemasNuevos = []) {
    const agregados = problemasNuevos.length - problemasAnteriores.length;
    const eliminados = problemasAnteriores.length - problemasNuevos.length;

    // Comparación simple por descripción
    const descripcionesAntes = problemasAnteriores.map(p => p.descripcion);
    const descripcionesDespues = problemasNuevos.map(p => p.descripcion);

    const nuevasDescripciones = descripcionesDespues.filter(d => !descripcionesAntes.includes(d));
    const descripcionesEliminadas = descripcionesAntes.filter(d => !descripcionesDespues.includes(d));

    return {
        agregados: nuevasDescripciones.length,
        eliminados: descripcionesEliminadas.length,
        total_antes: problemasAnteriores.length,
        total_despues: problemasNuevos.length,
        nuevos: nuevasDescripciones.slice(0, 3), // Máximo 3 para el resumen
        eliminados_desc: descripcionesEliminadas.slice(0, 3)
    };
}

/**
 * Detecta todos los cambios entre el informe anterior y los nuevos datos
 */
export function detectarCambiosInforme(informeAnterior, datosNuevos) {
    const cambios = {};

    // 1. Checklist items
    const cambiosChecklist = compararChecklist(
        informeAnterior.checklist_items,
        datosNuevos.checklist_items
    );
    if (cambiosChecklist.length > 0) {
        cambios.checklist_items = {
            modificados: cambiosChecklist.length,
            detalles: cambiosChecklist
        };
    }

    // 2. Checklist extra
    const cambiosExtra = compararArrays(
        (informeAnterior.checklist_extra || []).map(i => i.nombre),
        (datosNuevos.checklist_extra || []).map(i => i.nombre)
    );
    if (cambiosExtra.agregados.length > 0 || cambiosExtra.eliminados.length > 0) {
        cambios.checklist_extra = cambiosExtra;
    }

    // 3. Casos resueltos
    const cambiosCasos = compararArrays(
        informeAnterior.casos_resueltos || [],
        datosNuevos.casos_resueltos || []
    );
    if (cambiosCasos.agregados.length > 0 || cambiosCasos.eliminados.length > 0) {
        cambios.casos_resueltos = cambiosCasos;
    }

    // 4. Problemas resueltos
    const cambiosProblemas = compararProblemas(
        informeAnterior.problemasResueltos || [],
        datosNuevos.problemas_resueltos || []
    );
    if (cambiosProblemas.agregados > 0 || cambiosProblemas.eliminados > 0) {
        cambios.problemas_resueltos = cambiosProblemas;
    }

    // 5. Observaciones
    const obsAntes = (informeAnterior.observaciones || '').trim();
    const obsDespues = (datosNuevos.observaciones || '').trim();
    if (obsAntes !== obsDespues) {
        cambios.observaciones = {
            modificado: true,
            longitud_antes: obsAntes.length,
            longitud_despues: obsDespues.length,
            preview_antes: obsAntes.substring(0, 50) + (obsAntes.length > 50 ? '...' : ''),
            preview_despues: obsDespues.substring(0, 50) + (obsDespues.length > 50 ? '...' : '')
        };
    }

    return cambios;
}

/**
 * Genera un resumen legible de los cambios con detalles específicos
 */
export function generarResumenCambios(cambios) {
    const items = [];

    if (cambios.checklist_items) {
        const detalles = cambios.checklist_items.detalles || [];
        const modificados = detalles.filter(d => d.tipo === 'modificado');
        const agregados = detalles.filter(d => d.tipo === 'agregado');
        const eliminados = detalles.filter(d => d.tipo === 'eliminado');

        if (modificados.length > 0) {
            const nombres = modificados.slice(0, 3).map(d => `"${d.nombre}"`).join(', ');
            const resto = modificados.length > 3 ? ` y ${modificados.length - 3} más` : '';
            items.push(`Checklist modificado: ${nombres}${resto}`);
        }
        if (agregados.length > 0) {
            const nombres = agregados.slice(0, 2).map(d => `"${d.nombre}"`).join(', ');
            const resto = agregados.length > 2 ? ` y ${agregados.length - 2} más` : '';
            items.push(`Checklist agregado: ${nombres}${resto}`);
        }
        if (eliminados.length > 0) {
            const nombres = eliminados.slice(0, 2).map(d => `"${d.nombre}"`).join(', ');
            const resto = eliminados.length > 2 ? ` y ${eliminados.length - 2} más` : '';
            items.push(`Checklist eliminado: ${nombres}${resto}`);
        }
    }

    if (cambios.checklist_extra) {
        if (cambios.checklist_extra.agregados.length > 0) {
            const nombres = cambios.checklist_extra.agregados.slice(0, 2).map(n => `"${n}"`).join(', ');
            const resto = cambios.checklist_extra.agregados.length > 2 ? ` y ${cambios.checklist_extra.agregados.length - 2} más` : '';
            items.push(`Items adicionales agregados: ${nombres}${resto}`);
        }
        if (cambios.checklist_extra.eliminados.length > 0) {
            const nombres = cambios.checklist_extra.eliminados.slice(0, 2).map(n => `"${n}"`).join(', ');
            const resto = cambios.checklist_extra.eliminados.length > 2 ? ` y ${cambios.checklist_extra.eliminados.length - 2} más` : '';
            items.push(`Items adicionales eliminados: ${nombres}${resto}`);
        }
    }

    if (cambios.casos_resueltos) {
        if (cambios.casos_resueltos.agregados.length > 0) {
            const casos = cambios.casos_resueltos.agregados.slice(0, 3).map(c => `"${c}"`).join(', ');
            const resto = cambios.casos_resueltos.agregados.length > 3 ? ` y ${cambios.casos_resueltos.agregados.length - 3} más` : '';
            items.push(`Casos agregados: ${casos}${resto}`);
        }
        if (cambios.casos_resueltos.eliminados.length > 0) {
            const casos = cambios.casos_resueltos.eliminados.slice(0, 3).map(c => `"${c}"`).join(', ');
            const resto = cambios.casos_resueltos.eliminados.length > 3 ? ` y ${cambios.casos_resueltos.eliminados.length - 3} más` : '';
            items.push(`Casos eliminados: ${casos}${resto}`);
        }
    }

    if (cambios.problemas_resueltos) {
        if (cambios.problemas_resueltos.agregados > 0 && cambios.problemas_resueltos.nuevos) {
            const descripciones = cambios.problemas_resueltos.nuevos.slice(0, 2).map(d => `"${d}"`).join(', ');
            const resto = cambios.problemas_resueltos.agregados > 2 ? ` y ${cambios.problemas_resueltos.agregados - 2} más` : '';
            items.push(`Problemas agregados: ${descripciones}${resto}`);
        }
        if (cambios.problemas_resueltos.eliminados > 0 && cambios.problemas_resueltos.eliminados_desc) {
            const descripciones = cambios.problemas_resueltos.eliminados_desc.slice(0, 2).map(d => `"${d}"`).join(', ');
            const resto = cambios.problemas_resueltos.eliminados > 2 ? ` y ${cambios.problemas_resueltos.eliminados - 2} más` : '';
            items.push(`Problemas eliminados: ${descripciones}${resto}`);
        }
    }

    if (cambios.observaciones) {
        items.push('Observaciones del técnico modificadas');
    }

    return items.length > 0 ? items.join(' • ') : 'Sin cambios detectados';
}
