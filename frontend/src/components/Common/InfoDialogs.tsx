import type { ReactNode } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SITE } from "@/config/site"
import { SHORTCUTS } from "@/lib/shortcuts"

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

/** One shared shell so every information popup closes, scrolls and traps focus the same way. */
export function InfoDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
}: DialogProps & { title: string; description?: string; children: ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85svh] gap-4 overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <DialogDescription className="sr-only">{title}</DialogDescription>
          )}
        </DialogHeader>
        <div className="space-y-4 text-sm leading-6">{children}</div>
      </DialogContent>
    </Dialog>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="font-semibold">{title}</h3>
      {children}
    </section>
  )
}

function DraftNotice() {
  return (
    <p
      role="note"
      className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs font-medium text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
    >
      Draft, pending barangay review. This text is not yet approved by the
      barangay.
    </p>
  )
}

export function ShortcutsList() {
  return (
    <ul className="grid gap-2">
      {SHORTCUTS.map((item) => (
        <li
          key={item.description}
          className="flex items-center justify-between gap-4 rounded-md border px-3 py-2"
        >
          <span className="text-muted-foreground">{item.description}</span>
          <span className="flex shrink-0 items-center gap-1">
            {item.keys.map((key, index) =>
              key === "then" || key === "+" ? (
                <span
                  key={`${key}-${index}`}
                  className="text-xs text-muted-foreground"
                >
                  {key}
                </span>
              ) : (
                <kbd
                  key={`${key}-${index}`}
                  className="min-w-6 rounded border bg-muted px-1.5 py-0.5 text-center font-mono text-xs"
                >
                  {key}
                </kbd>
              ),
            )}
          </span>
        </li>
      ))}
    </ul>
  )
}

export function ShortcutsDialog(props: DialogProps) {
  return (
    <InfoDialog
      {...props}
      title="Keyboard shortcuts"
      description="Shortcuts do not work while you are typing in a box."
    >
      <ShortcutsList />
    </InfoDialog>
  )
}

export function HelpDialog(props: DialogProps) {
  return (
    <InfoDialog
      {...props}
      title="Get help"
      description="Everything here works without an internet connection."
    >
      <Section title="Signing in and out">
        <p>
          Sign in with the email address and password the System Administrator
          gave you. To sign out, open the profile menu at the top right and
          choose Logout.
        </p>
      </Section>
      <Section title="Finding a resident">
        <p>
          Open Records Management and type a name, address or ID number in the
          search box. Press{" "}
          <kbd className="rounded border bg-muted px-1">/</kbd> to jump to the
          search box.
        </p>
      </Section>
      <Section title="Issuing a document">
        <p>
          Open Issuance Management, choose New Issuance, pick the resident and
          the document type, check the details, then issue and print it on the
          pre-printed form.
        </p>
      </Section>
      <Section title="Common problems">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Forgot your password:</strong> ask the System Administrator
            to set a temporary password for you.
          </li>
          <li>
            <strong>A page says you have no permission:</strong> that page is
            for System Administrators only.
          </li>
          <li>
            <strong>The page will not load:</strong> check that the office
            computer that hosts the system is on and that you are on the office
            network.
          </li>
        </ul>
      </Section>
      <Section title="Who to contact">
        <p>Ask your System Administrator at the barangay office.</p>
      </Section>
      <Section title="Keyboard shortcuts">
        <ShortcutsList />
      </Section>
    </InfoDialog>
  )
}

export function LearnMoreDialog(props: DialogProps) {
  return (
    <InfoDialog
      {...props}
      title="About this system"
      description={`${SITE.systemName}, ${SITE.location}`}
    >
      <Section title="What it is">
        <p>
          A staff-only system for the barangay office. It keeps resident
          records, prepares and prints documents on the barangay&apos;s
          pre-printed forms, keeps issuance history including Barangay ID cards,
          and shows summaries and reports for office use.
        </p>
      </Section>
      <Section title="What it is not">
        <p>
          It is not a public website. Residents do not have accounts, apply
          online or pay online. It does not replace documents issued by other
          agencies.
        </p>
      </Section>
      <Section title="How it runs">
        <p>
          It runs on a computer in the barangay office and is used over the
          office network. Resident data and photos stay on that computer.
        </p>
      </Section>
      <Section title="Built by">
        <p>{SITE.developedBy}.</p>
      </Section>
    </InfoDialog>
  )
}

export function VersionDialog(props: DialogProps) {
  return (
    <InfoDialog {...props} title="Version" description={SITE.systemName}>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="text-muted-foreground">Version</dt>
        <dd className="font-medium">{__APP_VERSION__}</dd>
        <dt className="text-muted-foreground">Built on</dt>
        <dd className="font-medium">{__BUILD_DATE__}</dd>
        <dt className="text-muted-foreground">Status</dt>
        <dd className="font-medium">
          Prototype. Not yet approved for real data.
        </dd>
      </dl>
    </InfoDialog>
  )
}

export function TermsDialog(props: DialogProps) {
  return (
    <InfoDialog {...props} title="Terms of Use">
      <DraftNotice />
      <Section title="Who may use this system">
        <p>
          Only barangay office personnel with an account created by the System
          Administrator. Do not share your account or password.
        </p>
      </Section>
      <Section title="How to use it">
        <ul className="list-disc space-y-1 pl-5">
          <li>Use resident information only for barangay office work.</li>
          <li>Check every detail before issuing or printing a document.</li>
          <li>
            Do not alter issued records. Corrections are made with a reason and
            are kept in the history.
          </li>
          <li>Sign out when you leave the computer.</li>
        </ul>
      </Section>
      <Section title="Activity is recorded">
        <p>
          Issuing, correcting and account changes are recorded with your name
          and the time, so the office can review them.
        </p>
      </Section>
    </InfoDialog>
  )
}

export function PrivacyDialog(props: DialogProps) {
  return (
    <InfoDialog {...props} title="Privacy Policy">
      <DraftNotice />
      <Section title="What is kept">
        <p>
          Resident details needed for barangay documents, resident photos,
          issuance history and staff activity records.
        </p>
      </Section>
      <Section title="Why it is kept">
        <p>
          To prepare and print the documents the barangay issues and to keep an
          accurate record of them.
        </p>
      </Section>
      <Section title="Who can see it">
        <p>
          Signed-in barangay office personnel. The System Administrator has
          extra access to manage accounts and records.
        </p>
      </Section>
      <Section title="Where it is kept">
        <p>
          On the barangay office computer. Resident data and photos are not
          uploaded to the internet.
        </p>
      </Section>
      <Section title="Retention, corrections and questions">
        <p>
          How long records are kept and how residents may ask for corrections
          will follow the procedures the barangay approves under the Data
          Privacy Act. Ask the System Administrator for details.
        </p>
      </Section>
    </InfoDialog>
  )
}
