export function roleHomePath(role: string | undefined): string {
  if (role === 'uldc') return '/uldc'
  if (role === 'board') return '/board'
  if (role === 'admin_council') return '/admin-council'
  if (role === 'president') return '/president'
  return '/my-requests'
}