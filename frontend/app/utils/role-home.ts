export function roleHomePath(role: string | undefined): string {
  if (role === 'uldc_subcommittee') return '/uldc-subcommittee'
  if (role === 'uldc_committee') return '/uldc-committee'
  if (role === 'board') return '/board'
  if (role === 'admin_council') return '/admin-council'
  if (role === 'president') return '/president'
  return '/my-requests'
}