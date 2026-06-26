import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { PageShell } from "@/components/ui/page-shell"
import { Section } from "@/components/ui/section"

export default function DesignSystemPage() {
  return (
    <PageShell fullscreen className="px-4 py-10 space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-white">Design System</h1>
        <p className="text-sm text-zinc-400 mt-1">Referência visual dos primitivos do projeto</p>
      </div>

      {/* Typography */}
      <Section title="Tipografia">
        <Card className="space-y-3">
          <p className="text-2xl font-bold text-white">Título de página — text-2xl font-bold</p>
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">Título de seção — text-xs font-bold uppercase tracking-widest</p>
          <p className="text-sm text-white">Corpo — text-sm text-white</p>
          <p className="text-sm text-zinc-400">Texto secundário — text-sm text-zinc-400</p>
          <p className="text-xs text-zinc-500">Caption — text-xs text-zinc-500</p>
        </Card>
      </Section>

      {/* Badges */}
      <Section title="Badges">
        <Card className="flex flex-wrap gap-2">
          <Badge>default</Badge>
          <Badge variant="success">success</Badge>
          <Badge variant="warning">warning</Badge>
          <Badge variant="destructive">destructive</Badge>
          <Badge variant="outline">outline</Badge>
        </Card>
      </Section>

      {/* Buttons */}
      <Section title="Botões">
        <Card className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
        </Card>
        <Card className="flex flex-wrap gap-3">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </Card>
      </Section>

      {/* Cards */}
      <Section title="Cards">
        <Card>Card default (border + p-4)</Card>
        <Card variant="ghost">Card ghost (sem border)</Card>
        <Card padding="sm">Card padding sm</Card>
        <Card padding="lg">Card padding lg</Card>
        <Card padding="none" className="overflow-hidden">
          <div className="p-4 border-b border-zinc-800">Header sem padding no card</div>
          <div className="p-4">Body separado</div>
        </Card>
      </Section>

      {/* Inputs */}
      <Section title="Inputs">
        <Input placeholder="Input sem label" />
        <Input label="Nome do evento" placeholder="Ex: Casamento da Ana" />
        <Input
          label="Com erro"
          placeholder="Digite algo"
          defaultValue="valor inválido"
          error="Este campo é obrigatório"
        />
        <Input label="Desabilitado" placeholder="Não editável" disabled />
      </Section>

      {/* Page Shell info */}
      <Section title="PageShell">
        <Card className="space-y-2">
          <p className="text-sm text-white font-medium">Esta página usa <code className="text-zinc-400">PageShell fullscreen</code></p>
          <p className="text-sm text-zinc-400">Pages host normais usam <code className="text-zinc-400">PageShell</code> (sem fullscreen) para ganhar o <code className="text-zinc-400">pb-24</code> automático do bottom nav.</p>
        </Card>
      </Section>

      {/* Colors */}
      <Section title="Paleta">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "bg-[#0a0a0a]", cls: "bg-[#0a0a0a] border border-zinc-700" },
            { label: "bg-zinc-900", cls: "bg-zinc-900" },
            { label: "bg-zinc-800", cls: "bg-zinc-800" },
            { label: "bg-zinc-700", cls: "bg-zinc-700" },
            { label: "text-green-500", cls: "bg-green-500" },
            { label: "text-amber-400", cls: "bg-amber-400" },
            { label: "text-red-400", cls: "bg-red-400" },
            { label: "text-zinc-400", cls: "bg-zinc-400" },
          ].map(({ label, cls }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex-shrink-0 ${cls}`} />
              <span className="text-xs text-zinc-400 font-mono">{label}</span>
            </div>
          ))}
        </div>
      </Section>
    </PageShell>
  )
}
