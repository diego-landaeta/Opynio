# Debugging: Asignación de Empresas a Usuarios

## Problema
Cuando un admin asigna una empresa a un usuario, el usuario no puede acceder al dashboard de negocio.

## Cambios Implementados

### 1. Actualización de `updateUserRole()` - [services/supabaseService.ts:228-271](services/supabaseService.ts#L228-L271)

La función ahora:
- Acepta un tercer parámetro opcional `businessName`
- Crea automáticamente la empresa en la tabla `businesses` cuando se asigna el rol `business_owner`
- Incluye logging detallado para debugging

```typescript
export const updateUserRole = async (userId: string, role: string, businessName?: string) => {
  console.log('🔧 updateUserRole called:', { userId, role, businessName });

  if (role === 'business_owner' && businessName) {
    // Crear empresa
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert([{
        name: businessName,
        category: 'General',
        country: 'ES',
        owner_id: userId,
      }])
      .select()
      .single();

    if (businessError) {
      console.error('❌ Error creating business:', businessError);
      throw businessError;
    }

    console.log('✅ Business created successfully:', business);
  }

  // Actualizar rol
  const { data, error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    console.error('❌ Error updating role:', error);
    throw error;
  }

  console.log('✅ User role updated successfully:', data);
  return data;
};
```

### 2. Suscripción Realtime para Empresas - [contexts/AuthContext.tsx:229-254](contexts/AuthContext.tsx#L229-L254)

Se agregó una suscripción adicional para detectar cuando se crea una nueva empresa:

```typescript
const businessChannel = supabase
  .channel(`business-updates-${user.id}`)
  .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'businesses',
      filter: `owner_id=eq.${user.id}`,
    },
    async (payload) => {
      console.log('🔔 New business created via Realtime:', payload.new);
      const businessesData = await getBusinessesForOwner(user.id);
      console.log('📊 Businesses reloaded after INSERT:', businessesData);
      if (businessesData) {
        setBusinesses(businessesData);
      }
    }
  )
  .subscribe();
```

### 3. Logging Mejorado en `getBusinessesForOwner()` - [services/supabaseService.ts:450-464](services/supabaseService.ts#L450-L464)

```typescript
export const getBusinessesForOwner = async (userId: string) => {
  console.log('🔍 getBusinessesForOwner called for userId:', userId);
  const { data, error } = await supabase
    .from('businesses')
    .select('*')
    .eq('owner_id', userId);

  if (error) {
    console.error('❌ Error fetching businesses:', error);
    throw error;
  }

  console.log('✅ Businesses found:', data?.length || 0, data);
  return data || [];
};
```

## Cómo Debuggear el Problema

### Paso 1: Abrir la Consola del Navegador

1. Presiona `F12` o `Ctrl+Shift+I` (Windows/Linux) o `Cmd+Opt+I` (Mac)
2. Ve a la pestaña "Console"
3. Limpia la consola haciendo clic en el ícono de 🚫 o presionando `Ctrl+L`

### Paso 2: Asignar Empresa como Admin

1. Como admin, ve a `/admin/usuarios`
2. Selecciona un usuario (por ejemplo, "Angel")
3. Cambia el rol a "business_owner"
4. Ingresa el nombre de la empresa (por ejemplo, "Empresa de Prueba")
5. Haz clic en "Guardar"

### Paso 3: Revisar los Logs en la Consola

Deberías ver la siguiente secuencia de logs:

```
🔧 updateUserRole called: {userId: "xxxx-xxxx-xxxx", role: "business_owner", businessName: "Empresa de Prueba"}
📊 Creating business for user: xxxx-xxxx-xxxx
✅ Business created successfully: {id: "yyyy-yyyy-yyyy", name: "Empresa de Prueba", ...}
👤 Updating user role to: business_owner
✅ User role updated successfully: {id: "xxxx-xxxx-xxxx", role: "business_owner", ...}
```

### Paso 4: Verificar Realtime (como el Usuario Asignado)

Si el usuario "Angel" tiene la sesión abierta en otro navegador/pestaña, debería ver:

```
🔔 Profile updated via Realtime: {id: "xxxx-xxxx-xxxx", role: "business_owner", ...}
👔 Role changed to business_owner, fetching businesses for user: xxxx-xxxx-xxxx
🔍 getBusinessesForOwner called for userId: xxxx-xxxx-xxxx
✅ Businesses found: 1 [{id: "yyyy-yyyy-yyyy", name: "Empresa de Prueba", ...}]
📊 Businesses fetched: [{id: "yyyy-yyyy-yyyy", name: "Empresa de Prueba", ...}]
```

Y también:

```
🔔 New business created via Realtime: {id: "yyyy-yyyy-yyyy", name: "Empresa de Prueba", ...}
🔍 getBusinessesForOwner called for userId: xxxx-xxxx-xxxx
✅ Businesses found: 1 [{id: "yyyy-yyyy-yyyy", name: "Empresa de Prueba", ...}]
📊 Businesses reloaded after INSERT: [{id: "yyyy-yyyy-yyyy", name: "Empresa de Prueba", ...}]
```

## Posibles Problemas y Soluciones

### Problema 1: Error al crear la empresa

**Log:**
```
❌ Error creating business: {message: "...", code: "..."}
```

**Posibles causas:**
1. **Políticas RLS (Row Level Security)** de Supabase están bloqueando la inserción
2. **Falta de permisos** en la tabla `businesses`
3. **Columna requerida faltante** en la tabla

**Solución:**
1. Ve a Supabase Dashboard → Authentication → Policies
2. Verifica que exista una política que permita a los admins insertar en `businesses`
3. Verifica que la tabla `businesses` tenga las columnas: `id`, `name`, `category`, `country`, `owner_id`

### Problema 2: Error al actualizar el rol

**Log:**
```
❌ Error updating role: {message: "...", code: "..."}
```

**Posibles causas:**
1. **Políticas RLS** en la tabla `profiles` bloqueando la actualización
2. **Falta de permisos** para actualizar roles

**Solución:**
1. Verifica que exista una política que permita a los admins actualizar `profiles`
2. Verifica que el usuario admin tenga el rol `admin` correctamente asignado

### Problema 3: No se encuentra ninguna empresa

**Log:**
```
✅ Businesses found: 0 []
```

**Posibles causas:**
1. **La empresa no se creó** (ver logs anteriores)
2. **Políticas RLS** están bloqueando la lectura
3. **El `owner_id` no coincide** con el `user.id`

**Solución:**
1. Verifica en Supabase Dashboard → Table Editor → businesses que la empresa existe
2. Verifica que el `owner_id` de la empresa coincida con el `id` del usuario
3. Verifica las políticas RLS para lectura en la tabla `businesses`

### Problema 4: Realtime no funciona

**Log:**
No aparecen los logs con 🔔

**Posibles causas:**
1. **Realtime no está habilitado** en Supabase para las tablas `profiles` o `businesses`
2. **El usuario no está suscrito** correctamente

**Solución:**
1. Ve a Supabase Dashboard → Database → Replication
2. Habilita Realtime para las tablas `profiles` y `businesses`
3. Verifica que el usuario tenga una sesión activa

## Verificar Políticas RLS en Supabase

### Políticas Recomendadas para `businesses`

**Inserción (para admins):**
```sql
CREATE POLICY "Admins can insert businesses"
ON businesses
FOR INSERT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

**Lectura (para propietarios):**
```sql
CREATE POLICY "Users can read their own businesses"
ON businesses
FOR SELECT
TO authenticated
USING (owner_id = auth.uid());
```

**Lectura (para admins):**
```sql
CREATE POLICY "Admins can read all businesses"
ON businesses
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
```

### Políticas Recomendadas para `profiles`

**Actualización (para admins):**
```sql
CREATE POLICY "Admins can update user roles"
ON profiles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles AS p
    WHERE p.id = auth.uid()
    AND p.role = 'admin'
  )
);
```

## Comandos Útiles en Consola del Navegador

### Ver el estado actual del usuario

```javascript
// En la consola del navegador
console.log('User:', window.localStorage.getItem('supabase.auth.token'))
```

### Verificar el perfil actual

```javascript
// Necesitas acceder al contexto de React, pero puedes ver el estado en React DevTools
// Instala React Developer Tools en tu navegador
// Luego busca "AuthContext" en el árbol de componentes
```

## Próximos Pasos

1. **Probar la asignación** con los logs habilitados
2. **Revisar la consola** para identificar el error exacto
3. **Verificar políticas RLS** en Supabase si hay errores de permisos
4. **Revisar Realtime** si las empresas no aparecen automáticamente

## Contacto y Soporte

Si el problema persiste después de seguir estos pasos, revisa:
- Los logs de Supabase en el Dashboard
- La configuración de Realtime
- Las políticas RLS de las tablas involucradas
