/*
Public enterprise contact page.
Lives in aurora's top-level routes tree (not under _authenticated) so
prospective customers can reach it without an account.
*/
import { createFileRoute } from '@tanstack/react-router'
import { Enterprise } from '@/features/enterprise'

export const Route = createFileRoute('/enterprise')({
  component: Enterprise,
})
