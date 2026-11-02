export const isValidPhone = (value) => value == null || value === '' || /^\d{10}$/.test(value)

export async function getAuthenticatedUser(db, authId) {
  const { rows } = await db.query(
    'SELECT user_id, name, email, contact_info FROM users WHERE auth_user_id = $1',
    [authId],
  )
  return rows[0] || null
}

export function profileIsComplete(user) {
  return Boolean(user?.name?.trim() && /^\d{10}$/.test(user?.contact_info || ''))
}

export function validProfileInput(name, phone) {
  return (name == null || typeof name === 'string') && isValidPhone(phone)
}
