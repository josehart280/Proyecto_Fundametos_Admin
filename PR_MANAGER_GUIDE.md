# 🤖 PR Manager / GitHub Production Controller

Sistema automatizado de análisis de ramas, pull requests y control de calidad para producción.

## 📋 Índice

- [Configuración Automática](#configuración-automática)
- [Flujo de Trabajo](#flujo-de-trabajo)
- [Análisis de Ramas](#análisis-de-ramas)
- [Reportes Generados](#reportes-generados)
- [Checklist de Producción](#checklist-de-producción)

---

## 🚀 Configuración Automática

### Paso 1: Activar GitHub Actions

El workflow `branch-analyzer.yml` se ejecuta automáticamente en cada push a ramas no-main y en cada PR.

### Paso 2: Configurar Branch Protection (Recomendado)

Ejecutar desde PowerShell como administrador:

```powershell
# Configurar protección de rama main
gh api repos/:owner/:repo/branches/main/protection --method PUT \
  --input - <<< '{
    "required_status_checks": {
      "strict": true,
      "contexts": ["Branch Analyzer"]
    },
    "enforce_admins": true,
    "required_pull_request_reviews": {
      "required_approving_review_count": 1
    },
    "restrictions": null
  }'
```

### Paso 3: Usar el Analizador Local

Para analizar una rama antes de crear PR:

```bash
# Linux/Mac
cd scripts
chmod +x merge-analyzer.sh
./merge-analyzer.sh nombre-rama-origen main

# Windows (Git Bash)
bash scripts/merge-analyzer.sh nombre-rama-origen main
```

---

## 📊 Flujo de Trabajo

```
┌─────────────────────────────────────────────────────────────┐
│  1. Crear Rama de Feature                                    │
│     git checkout -b feature/nueva-funcionalidad            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Desarrollar y Commitear                                  │
│     git add . && git commit -m "feat: descripción"          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Analizar Localmente (Opcional)                          │
│     bash scripts/merge-analyzer.sh feature/... main          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Push y Crear PR                                         │
│     git push origin feature/nueva-funcionalidad             │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  5. GitHub Actions Analiza Automáticamente                  │
│     - Comenta en el PR con análisis                         │
│     - Genera artefacto con reporte                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  6. Code Review                                             │
│     - Revisar comentarios del bot                          │
│     - Verificar checklist                                  │
│     - Aprobar o solicitar cambios                          │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  7. Merge a Main                                            │
│     Solo si pasa todas las verificaciones                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 Análisis de Ramas

### Detección Automática de Problemas

El sistema detecta automáticamente:

| Patrón | Severidad | Acción |
|--------|-----------|--------|
| `'${var}'` en SQL | 🔴 Crítica | Bloquea merge |
| `console.log` | 🟡 Advertencia | Requiere limpieza |
| `id_Personal = 1` | 🟡 Advertencia | Requiere auth real |
| `TODO/FIXME` | 🟡 Advertencia | Documentar o resolver |
| Dependencias nuevas | 🟡 Revisión | Verificar seguridad |

### Reporte Generado

Cada análisis genera un archivo `MERGE_ANALYSIS_YYYYMMDD_HHMMSS.md` con:

1. **Resumen de cambios** - Archivos modificados
2. **Estadísticas** - Insertions/deletions
3. **Análisis de seguridad** - Problemas detectados
4. **Dependencias** - Cambios en package.json
5. **Checklist** - Items a verificar
6. **Recomendación** - Aprobado/Rechazado

---

## 📄 Reportes Generados

### Estructura del Reporte

```markdown
# 📊 Merge Analysis Report

**Source Branch**: feature/nueva-funcion
**Target Branch**: main
**Analysis Date**: 2026-03-23 14:30:00

## 📈 Resumen del Análisis

### Commits de Diferencia
```
abc1234 feat: Nueva funcionalidad
xyz5678 fix: Corrección de bug
```

### Archivos Modificados
| Estado | Archivo |
|--------|---------|
| M | public/js/dashboard.js |
| A | public/nueva-funcion.html |

### 🔒 Análisis de Seguridad
- 🔴 **CRÍTICO**: Posible SQL Injection
- ✅ No se detectaron console.log

### ✅ Checklist Pre-Merge
- [ ] Código revisado
- [ ] Tests pasan
...

### 📝 Recomendación
**Estado**: 🔴 NO APROBADO
```

---

## ✅ Checklist de Producción

### Antes de cualquier deploy:

- [ ] **Seguridad**
  - [ ] Sin SQL Injection
  - [ ] Sin credenciales hardcodeadas
  - [ ] Validaciones server-side
  - [ ] Sanitización de inputs

- [ ] **Calidad de Código**
  - [ ] Sin console.log de debug
  - [ ] Sin código comentado
  - [ ] Variables con nombres descriptivos
  - [ ] Funciones documentadas

- [ ] **Testing**
  - [ ] npm start sin errores
  - [ ] APIs responden correctamente
  - [ ] Frontend sin errores en consola
  - [ ] Flujo de usuario funcional

- [ ] **Documentación**
  - [ ] README.md actualizado
  - [ ] CLAUDE.md actualizado (si aplica)
  - [ ] Changelog actualizado

- [ ] **Git**
  - [ ] Commits con mensajes descriptivos
  - [ ] Branch actualizada con main
  - [ ] Sin conflictos de merge
  - [ ] PR aprobado por reviewer

---

## 🛠️ Comandos del PR Manager

### Análisis Local

```bash
# Analizar rama actual vs main
bash scripts/merge-analyzer.sh mi-rama main

# Ver último análisis
cat MERGE_ANALYSIS_*.md | head -50
```

### GitHub CLI

```bash
# Ver PRs abiertas
gh pr list

# Ver detalle de PR
gh pr view <numero>

# Crear PR con template
gh pr create --template PULL_REQUEST_TEMPLATE.md

# Ver checks de PR
gh pr checks <numero>

# Mergear PR (solo si pasa checks)
gh pr merge <numero> --squash
```

---

## 🔧 Configuración Avanzada

### Personalizar Reglas de Análisis

Editar `.github/workflows/branch-analyzer.yml`:

```yaml
# Agregar más patrones de seguridad
- name: Custom Security Scan
  run: |
    if git diff | grep -q "patron-peligroso"; then
      echo "⚠️ Patrón peligroso detectado"
      exit 1
    fi
```

### Excluir Archivos del Análisis

```yaml
# En el workflow
paths-ignore:
  - '**.md'
  - 'docs/**'
```

---

## 📞 Soporte

Para problemas con el PR Manager:

1. Verificar que GitHub Actions está habilitado
2. Revisar logs del workflow en la pestaña "Actions"
3. Ejecutar análisis local para debugging
4. Contactar al administrador del repositorio

---

**Versión**: 1.0
**Última actualización**: 2026-03-23
**Mantenido por**: Claude Code - PR Manager Bot
