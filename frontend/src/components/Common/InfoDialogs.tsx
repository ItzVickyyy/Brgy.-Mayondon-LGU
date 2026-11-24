import {
  ChevronRight,
  CircleHelp,
  Info,
  Keyboard,
  type LucideIcon,
  MessageSquareText,
  ScrollText,
  Search,
  ShieldCheck,
  Tag,
} from "lucide-react"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import {
  modalBody,
  modalFooter,
  modalHeader,
  modalShell,
} from "@/components/Common/ModalLayout"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  DEV_CONTACT,
  DEV_GUIDES,
  DEV_TEAM,
  type DevNotePerson,
} from "@/config/dev-note"
import { SITE } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
import { SHORTCUTS } from "@/lib/shortcuts"
import { cn } from "@/lib/utils"

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

const widths = {
  /** Short pages such as Version. */
  md: "sm:max-w-md",
  /** Every reading page (Get help, Learn more, Terms, Privacy, Dev Note, About) shares this one width. */
  lg: "sm:max-w-5xl",
} as const

/**
 * One shared shell so every information popup looks, closes, scrolls and traps focus the same way.
 * The header and the Close button stay in place while only the text scrolls (see ModalLayout).
 * `flushTop` removes the top padding of the body for pages that start with a sticky contents bar.
 */
export function InfoDialog({
  open,
  onOpenChange,
  title,
  description,
  icon: Icon,
  size = "lg",
  flushTop = false,
  children,
}: DialogProps & {
  title: string
  description?: string
  icon?: LucideIcon
  size?: keyof typeof widths
  flushTop?: boolean
  children: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(modalShell, widths[size])}>
        <DialogHeader className={modalHeader}>
          <div className="flex items-center gap-3 text-left">
            {Icon ? (
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand"
              >
                <Icon className="size-5" />
              </span>
            ) : null}
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="text-lg leading-tight">
                {title}
              </DialogTitle>
              {description ? (
                <DialogDescription className="text-xs sm:text-sm">
                  {description}
                </DialogDescription>
              ) : (
                <DialogDescription className="sr-only">
                  {title}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>
        <div
          className={cn(
            modalBody,
            "space-y-5 text-sm leading-6",
            flushTop && "pt-0",
          )}
        >
          {children}
        </div>
        <div className={cn(modalFooter, "flex justify-end")}>
          <Button
            type="button"
            variant="outline"
            data-testid="info-close"
            onClick={() => onOpenChange(false)}
          >
            {t("common.ui.close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn("space-y-1.5", className)}>
      <h3 className="font-semibold text-brand">{title}</h3>
      {children}
    </section>
  )
}

function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-1 pl-5">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ol>
  )
}

/** A quiet highlighted note, with a thin marker on the left. */
function Callout({ children }: { children: ReactNode }) {
  return (
    <p
      role="note"
      className="rounded-md border-l-2 border-brand bg-muted/60 px-3 py-2 text-sm"
    >
      {children}
    </p>
  )
}

/** A collapsible group so the long help text stays easy to scan. */
function HelpGroup({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon?: LucideIcon
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details
      open={defaultOpen}
      data-help-group=""
      data-default-open={defaultOpen ? "true" : "false"}
      className="group rounded-lg border bg-card open:shadow-xs"
    >
      <summary className="flex min-h-11 cursor-pointer select-none list-none items-center gap-2.5 rounded-lg px-3 py-2 font-semibold hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
        />
        {Icon ? (
          <Icon aria-hidden="true" className="size-4 shrink-0 text-brand" />
        ) : null}
        <span className="min-w-0 flex-1">{title}</span>
      </summary>
      <div className="grid gap-x-8 gap-y-4 border-t px-4 pb-4 pt-3 md:grid-cols-2 md:[&>:not(section)]:col-span-2">
        {children}
      </div>
    </details>
  )
}

/**
 * Get help search (patch 252). The help text is plain markup, so the filter works on the page
 * itself: a topic (a `section`, or a `li` such as a problem or shortcut) stays when it holds every
 * typed word, a group opens when something in it matches and hides when nothing does, and
 * clearing the box puts every group back as it started. Returns how many topics match.
 */
export function applyHelpFilter(root: HTMLElement, query: string): number {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const has = (text: string | null) =>
    words.every((word) => (text ?? "").toLowerCase().includes(word))
  let matched = 0
  for (const group of root.querySelectorAll<HTMLDetailsElement>(
    "details[data-help-group]",
  )) {
    const topics = Array.from(
      group.querySelectorAll<HTMLElement>("section, li"),
    ).filter((el) => {
      const outer = el.parentElement?.closest("section, li")
      return !outer || !group.contains(outer)
    })
    if (words.length === 0) {
      for (const topic of topics) topic.hidden = false
      group.hidden = false
      group.open = group.dataset.defaultOpen === "true"
      continue
    }
    const titleHit = has(group.querySelector("summary")?.textContent ?? "")
    let any = false
    if (topics.length === 0) {
      any = titleHit || has(group.textContent)
      if (any) matched += 1
    } else {
      for (const topic of topics) {
        const ok = titleHit || has(topic.textContent)
        topic.hidden = !ok
        if (ok) {
          any = true
          matched += 1
        }
      }
    }
    group.hidden = !any
    group.open = any
  }
  return matched
}

function HelpSearch({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("")
  const [matched, setMatched] = useState<number | null>(null)
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!body.current) return
    const count = applyHelpFilter(body.current, query)
    setMatched(query.trim() ? count : null)
  }, [query])

  return (
    <>
      <div className="sticky top-0 z-10 -mt-1 bg-background pb-2 pt-1">
        <div className="relative">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            data-testid="help-search"
            aria-label="Search the help"
            placeholder="Search the help, for example: print, password, backup"
            value={query}
            maxLength={80}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
            className="h-11 w-full rounded-md border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <p
          aria-live="polite"
          data-testid="help-search-count"
          className="mt-1 min-h-5 text-xs text-muted-foreground"
        >
          {matched === null
            ? ""
            : matched === 0
              ? "Nothing matches. Try one word, such as print or password."
              : `${matched} ${matched === 1 ? "topic matches" : "topics match"}.`}
        </p>
      </div>
      <div ref={body} className="space-y-5">
        {children}
      </div>
    </>
  )
}

function Problem({ q, children }: { q: string; children: ReactNode }) {
  return (
    <li>
      <strong>{q}</strong> {children}
    </li>
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
      icon={Keyboard}
      title="Keyboard shortcuts"
      description="Shortcuts do not work while you are typing in a box."
    >
      <ShortcutsList />
    </InfoDialog>
  )
}

/* ------------------------------------------------------------------ */
/* Long reading pages (Terms of Use, Privacy Policy)                  */
/* ------------------------------------------------------------------ */

type LegalSection = {
  id: string
  title: string
  /** Short label for the contents bar. */
  short: string
  body: ReactNode
}

/** Numbered sections with a contents bar that stays at the top while the text scrolls. */
function LegalDocument({
  prefix,
  sections,
}: {
  prefix: string
  sections: LegalSection[]
}) {
  const jump = (id: string) => {
    const element = document.getElementById(`${prefix}-${id}`)
    if (!element) return
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    element.scrollIntoView({
      behavior: reduce ? "auto" : "smooth",
      block: "start",
    })
  }

  return (
    <>
      <nav
        aria-label="Sections"
        className="sticky top-0 z-10 -mx-5 border-b bg-background px-5 sm:-mx-6 sm:px-6"
      >
        <ul className="flex gap-1.5 overflow-x-auto py-1.5">
          {sections.map((section, index) => (
            <li key={section.id} className="shrink-0">
              <button
                type="button"
                aria-label={`${index + 1}. ${section.title}`}
                onClick={() => jump(section.id)}
                className="min-h-11 whitespace-nowrap rounded-full border px-3 text-xs text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {index + 1}. {section.short}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="space-y-6">
        {sections.map((section, index) => (
          <section
            key={section.id}
            id={`${prefix}-${section.id}`}
            className="scroll-mt-16 space-y-2"
          >
            <h3 className="flex items-baseline gap-2 font-semibold">
              <span className="text-brand tabular-nums">{index + 1}.</span>
              {section.title}
            </h3>
            {section.body}
          </section>
        ))}
      </div>
    </>
  )
}

export function TermsDialog(props: DialogProps) {
  const sections: LegalSection[] = [
    {
      id: "about",
      title: "About these terms",
      short: "About",
      body: (
        <p>
          These terms explain the rules for using the {SITE.systemName}. By
          signing in, you agree to follow them. If you do not agree, do not use
          the system.
        </p>
      ),
    },
    {
      id: "who",
      title: "Who may use the system",
      short: "Who may use it",
      body: (
        <p>
          Only barangay office personnel with an account created by the System
          Administrator may use this system. There is no public sign-up.
          Residents do not have accounts.
        </p>
      ),
    },
    {
      id: "account",
      title: "Your account",
      short: "Your account",
      body: (
        <Bullets
          items={[
            "Your account is for you only. Do not share your email or password.",
            "Keep your password private. If you think someone else knows it, tell the System Administrator right away.",
            "If you receive a temporary password, change it when you first sign in.",
            "Sign out when you leave the computer.",
            "You are responsible for actions made under your account.",
          ]}
        />
      ),
    },
    {
      id: "use",
      title: "How you may use the system",
      short: "How to use it",
      body: (
        <>
          <p>You may use the system only for barangay office work, such as:</p>
          <Bullets
            items={[
              "keeping resident records,",
              "preparing and printing barangay documents and IDs,",
              "reviewing issuance history and reports.",
            ]}
          />
        </>
      ),
    },
    {
      id: "not",
      title: "What you must not do",
      short: "Not allowed",
      body: (
        <Bullets
          items={[
            "Do not use resident information for personal reasons or share it with people who are not authorized.",
            "Do not look up residents without an office reason.",
            "Do not issue a document that you know has wrong or false details.",
            "Do not try to get into pages, records or accounts that you are not allowed to use.",
            "Do not try to damage, change or bypass how the system works.",
            "Do not copy, remove or give out resident data, photos or backups without permission from the barangay.",
          ]}
        />
      ),
    },
    {
      id: "accuracy",
      title: "Accuracy and responsibility for documents",
      short: "Documents",
      body: (
        <Bullets
          items={[
            "Check every detail before you issue or print a document.",
            "Documents are issued under the authority of the barangay. Only issue what the barangay allows you to issue.",
            "Issued records are not edited directly. If a document has a mistake, use Correct or Void and give a reason. Do not delete records.",
          ]}
        />
      ),
    },
    {
      id: "activity",
      title: "Activity is recorded",
      short: "Activity",
      body: (
        <p>
          The system records actions such as signing in, issuing, correcting,
          voiding and account changes. Each record includes your name and the
          time. The barangay may review these records.
        </p>
      ),
    },
    {
      id: "roles",
      title: "Roles and access",
      short: "Roles",
      body: (
        <>
          <Bullets
            items={[
              "Staff can work with resident records, issuances and their own activity.",
              "System Administrators can also manage user accounts, officials, reports and backups.",
            ]}
          />
          <p>
            The System Administrator may change or turn off an account at any
            time, for example when a person leaves the office or when these
            terms are broken.
          </p>
        </>
      ),
    },
    {
      id: "privacy",
      title: "Data and privacy",
      short: "Data",
      body: (
        <p>
          Resident details, photos and issuance history are kept on the barangay
          office computer. Handling of this information follows the Privacy
          Policy and the procedures the barangay approves under the Data Privacy
          Act.
        </p>
      ),
    },
    {
      id: "availability",
      title: "Availability",
      short: "Availability",
      body: (
        <p>
          The system runs on a computer in the barangay office and is used over
          the office network. It may be unavailable when the computer is off,
          being repaired or being updated. The barangay does not promise that it
          will always be available or free of errors. Keep a way to continue
          office work if the system is down.
        </p>
      ),
    },
    {
      id: "backups",
      title: "Backups",
      short: "Backups",
      body: (
        <p>
          The System Administrator is responsible for backing up the database
          and keeping copies in a safe place, such as an external drive.
        </p>
      ),
    },
    {
      id: "broken",
      title: "If these terms are broken",
      short: "Breaking terms",
      body: (
        <p>
          The barangay may turn off the account of anyone who breaks these
          terms. Other action may follow under barangay rules and applicable
          law.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to these terms",
      short: "Changes",
      body: (
        <p>
          The barangay may update these terms. The newest version is shown in
          the system. Continuing to use the system means you accept the update.
        </p>
      ),
    },
    {
      id: "questions",
      title: "Questions",
      short: "Questions",
      body: <p>Ask the System Administrator at the barangay office.</p>,
    },
  ]

  return (
    <InfoDialog
      {...props}
      icon={ScrollText}
      flushTop
      title="Terms of Use"
      description={`${SITE.systemName}, ${SITE.location}`}
    >
      <LegalDocument prefix="terms" sections={sections} />
    </InfoDialog>
  )
}

export function PrivacyDialog(props: DialogProps) {
  const sections: LegalSection[] = [
    {
      id: "about",
      title: "About this policy",
      short: "About",
      body: (
        <p>
          This policy explains what personal information the {SITE.systemName}{" "}
          keeps, why it is kept, who can see it, and how it is protected. It
          follows the Data Privacy Act of 2012 (Republic Act No. 10173).
        </p>
      ),
    },
    {
      id: "covers",
      title: "Who this policy covers",
      short: "Who it covers",
      body: (
        <Bullets
          items={[
            "Residents whose details are recorded in the system.",
            "Barangay office personnel who have an account.",
          ]}
        />
      ),
    },
    {
      id: "kept",
      title: "What information is kept",
      short: "What is kept",
      body: (
        <>
          <div className="space-y-1">
            <h4 className="font-medium">About residents</h4>
            <Bullets
              items={[
                "Name, birthdate, birthplace, sex and civil status",
                "Home address and the year they started living in the barangay",
                "Photo",
                "Barangay ID number and ID card history",
                "Emergency contact name, address and number (for Barangay IDs)",
                "Family details and sector (for example senior citizen, PWD, solo parent)",
                "Details given for a document, such as purpose, the ID presented, official receipt number, and for some certifications, a health condition",
              ]}
            />
          </div>
          <div className="space-y-1">
            <h4 className="font-medium">About documents issued</h4>
            <Bullets
              items={[
                "The type of document, reference number, date, validity, purpose and who issued it",
                "Corrections and voids, with the reason given",
              ]}
            />
          </div>
          <div className="space-y-1">
            <h4 className="font-medium">About staff</h4>
            <Bullets
              items={[
                "Name, email address, profile photo and role",
                "Activity records: what the person did in the system, and when",
              ]}
            />
          </div>
          <div className="space-y-1">
            <h4 className="font-medium">About barangay officials</h4>
            <Bullets
              items={[
                "Name, position and term dates, which are printed on documents as signatories and witnesses",
              ]}
            />
          </div>
          <Callout>
            Some of this is sensitive personal information, such as health
            conditions, sector details and government ID numbers. It gets extra
            care.
          </Callout>
        </>
      ),
    },
    {
      id: "why",
      title: "Why it is kept",
      short: "Why",
      body: (
        <>
          <Bullets
            items={[
              "To prepare and print clearances, certifications and Barangay IDs.",
              "To keep an accurate record of what the barangay issued.",
              "To tell the office when clearances and IDs are about to expire.",
              "To produce summaries and reports for office use.",
              "To keep a record of staff actions so the office can review them.",
              "To manage staff accounts and sign-ins.",
            ]}
          />
          <p>The information is not used for advertising or sold to anyone.</p>
        </>
      ),
    },
    {
      id: "see",
      title: "Who can see it",
      short: "Who can see it",
      body: (
        <Bullets
          items={[
            "Signed-in barangay office personnel can see resident records and issuance history as their work requires.",
            "System Administrators have extra access to manage accounts, officials, reports and backups.",
            "Staff can see their own activity records. System Administrators can see everyone's.",
            "Residents do not have accounts and cannot see the system.",
          ]}
        />
      ),
    },
    {
      id: "where",
      title: "Where it is kept",
      short: "Where",
      body: (
        <p>
          Resident data, photos and records are stored on the barangay office
          computer and used over the office network. They are not uploaded to
          the internet. If the office sets up email for password recovery, a
          staff member's email address is used to send that message.
        </p>
      ),
    },
    {
      id: "sharing",
      title: "Sharing information",
      short: "Sharing",
      body: (
        <>
          <p>Information is not shared outside the barangay office except:</p>
          <Bullets
            items={[
              "on the printed document given to the resident who asked for it,",
              "when the law requires it, for example a valid request from a court or a government agency.",
            ]}
          />
        </>
      ),
    },
    {
      id: "protected",
      title: "How it is protected",
      short: "Protection",
      body: (
        <>
          <Bullets
            items={[
              "Every user signs in with a personal email and password. Two-factor sign-in adds a second step.",
              "Users only see the pages their role allows.",
              "A signed-in computer that is left alone is signed out after 30 minutes.",
              "Issuing, correcting and account changes are recorded with the user's name and the time. Opening a record that holds a health condition is recorded too.",
              "Issued records are not edited directly. Corrections are made with a reason and kept in the history.",
              "The System Administrator backs up the database and keeps copies in a safe place.",
              "Staff must keep passwords private and sign out when they leave the computer.",
            ]}
          />
          <p>
            No system is completely risk-free. If a data breach happens, the
            barangay will respond and give notice as the law requires.
          </p>
        </>
      ),
    },
    {
      id: "retention",
      title: "How long it is kept",
      short: "How long",
      body: (
        <p>
          Records are kept for as long as the barangay needs them. Residents who
          moved away or passed away are archived, not deleted. Archived records
          stay in the system until the barangay decides otherwise.
        </p>
      ),
    },
    {
      id: "rights",
      title: "Your rights",
      short: "Your rights",
      body: (
        <>
          <p>Under the Data Privacy Act, residents may:</p>
          <Bullets
            items={[
              "ask what information the barangay keeps about them,",
              "ask for wrong information to be corrected,",
              "object to how their information is used, or ask for it to be blocked or removed where the law allows,",
              "file a complaint with the National Privacy Commission.",
            ]}
          />
          <p>
            To ask for any of these, go to the barangay office and ask the
            System Administrator. The barangay will tell you what it can and
            cannot do under the law.
          </p>
        </>
      ),
    },
    {
      id: "photos",
      title: "Residents' photos",
      short: "Photos",
      body: (
        <p>
          Photos are taken for Barangay IDs and for documents with a photo box.
          Ask the resident before taking the photo. The photo is used only for
          barangay documents and records.
        </p>
      ),
    },
    {
      id: "changes",
      title: "Changes to this policy",
      short: "Changes",
      body: (
        <p>
          The barangay may update this policy. The newest version is shown in
          the system.
        </p>
      ),
    },
    {
      id: "questions",
      title: "Questions",
      short: "Questions",
      body: <p>Ask the System Administrator at the barangay office.</p>,
    },
  ]

  return (
    <InfoDialog
      {...props}
      icon={ShieldCheck}
      flushTop
      title="Privacy Policy"
      description={`${SITE.systemName}, ${SITE.location}`}
    >
      <LegalDocument prefix="privacy" sections={sections} />
    </InfoDialog>
  )
}

/* ------------------------------------------------------------------ */
/* Get help                                                            */
/* ------------------------------------------------------------------ */

function DeveloperContact() {
  const lines: [string, string][] = []
  if (DEV_CONTACT.email) lines.push(["Email", DEV_CONTACT.email])
  if (DEV_CONTACT.phone) lines.push(["Phone or messaging", DEV_CONTACT.phone])
  if (DEV_CONTACT.hours) lines.push(["Hours", DEV_CONTACT.hours])
  return (
    <>
      <Section title="Who to contact">
        <p>
          First ask your System Administrator at the barangay office. They can
          fix most account and password problems right away. If they cannot
          solve it, contact the developers: {SITE.developedBy}.
        </p>
        {lines.length ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {lines.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        <ul className="space-y-2">
          {DEV_TEAM.map((person) => (
            <li
              key={person.name}
              className="rounded-lg border bg-background px-3 py-2"
            >
              <p className="font-semibold">{person.name}</p>
              <p className="text-xs text-muted-foreground">{person.role}</p>
              {person.github ? (
                <p className="mt-0.5 font-mono text-xs">{person.github}</p>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Before you contact us">
        <p>These solve most problems:</p>
        <Bullets
          items={[
            "Refresh the page.",
            "Check that the office computer hosting the system is on and that you are on the office network.",
            "Sign out and sign in again.",
            "For a forgotten password, ask the System Administrator to set a temporary password.",
            "Read the Common problems section above.",
          ]}
        />
      </Section>
      <Section title="What to include in your message">
        <Steps
          items={[
            "Your name and role (Staff or System Administrator).",
            "The page you were on, for example Issuance Management or Records Management.",
            "What you were trying to do, for example issue a Barangay Clearance.",
            "What happened instead, and the exact message on the screen if there was one.",
            "When it happened (date and time).",
            "A screenshot, if possible.",
            "Whether it happens every time or only sometimes.",
            "The release code shown in Version (the link in the footer).",
          ]}
        />
        <Callout>
          Do not send passwords, or resident details such as full names with
          birthdates, addresses or ID numbers. If we need to see a record, we
          will ask how to do that safely.
        </Callout>
      </Section>
      <Section title="Types of requests">
        <Bullets
          items={[
            "Something is not working: the page will not load, a button does nothing, or printing is off.",
            "A mistake in the system: wrong text on a document, a wrong total, or a missing option in a list.",
            "A question about how to use it: how to issue a document, add an official or run a report.",
            "A suggestion: something that would make office work easier.",
            "A change to the lists: a new street, association or sector. System Administrators can do this in Issuance settings.",
          ]}
        />
      </Section>
      <Section title="Urgent problems">
        <p>
          If the system is down and the office cannot issue documents, tell the
          System Administrator first, then the developers. Mark your message
          URGENT and say what is stopped.
        </p>
        <p>
          Never delete or edit issued records to work around a problem. Wait for
          help, or use Correct or Void with a reason.
        </p>
      </Section>
      <Section title="What to expect">
        <p>
          We will reply as soon as we can. How fast depends on the problem and
          on who is available. Simple questions are answered first. Fixes to the
          system may take longer and are tested before they are put on the
          office computer.
        </p>
      </Section>
    </>
  )
}

export function HelpDialog(props: DialogProps) {
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)

  return (
    <InfoDialog
      {...props}
      icon={CircleHelp}
      title="Get help"
      description="Short guides for everyday office work. Everything here works without an internet connection."
    >
      <HelpSearch>
        <HelpGroup title="Getting started" defaultOpen>
          <Section title="Signing in">
            <Steps
              items={[
                "Open the system on the office computer or any computer on the office network.",
                "Type your email address and password, then choose Sign in.",
                "Your account is made by the System Administrator. There is no public sign-up.",
              ]}
            />
          </Section>
          <Section title="Your first sign-in">
            <p>
              If the System Administrator gave you a temporary password, the
              system asks you to set a new one before you continue. The new
              password must have at least 12 characters. After saving it, sign
              in again with the new password.
            </p>
          </Section>
          <Section title="Signing out">
            <p>
              Open the profile menu (your name) and choose Logout. Always sign
              out when you leave the computer. A computer left alone is signed
              out after 30 minutes.
            </p>
          </Section>
          <Section title="Your account and the profile menu">
            <p>
              The profile menu has My Account (your details, photo and
              password), Preferences (theme, colour and text size), Language,
              Get help, Learn more and Logout.
            </p>
          </Section>
          <Section title="What each person can see">
            <p>
              Staff use the Dashboard, Activity Log, Issuance Management and
              Records Management. Officials, User Accounts, Management Reports
              and Backup and Restore are for System Administrators only.
            </p>
          </Section>
        </HelpGroup>

        <HelpGroup title="Dashboard">
          <p>
            The Dashboard is the first page after you sign in. Use the Period
            menu (Today, This Week, This Month, Past 3 Months, Past 6 Months,
            This Year, Overall) to change the numbers.
          </p>
          <Bullets
            items={[
              <>
                <strong>Documents Issued This Month:</strong> how many documents
                the office issued.
              </>,
              <>
                <strong>
                  Clearances and Barangay IDs expiring in 30 days:
                </strong>{" "}
                records that will need renewing soon.
              </>,
              <>
                <strong>Pending Document Requests:</strong> drafts that were
                started but not yet issued.
              </>,
              <>
                <strong>Quick Actions:</strong> shortcuts to find a resident,
                create an issuance or review history.
              </>,
            ]}
          />
        </HelpGroup>

        <HelpGroup title="Finding and managing residents">
          <Section title="Find a resident">
            <Steps
              items={[
                "Open Records Management.",
                "Type a name, address or ID number in the search box. Press / to jump to it.",
                "From any page, press Ctrl+K, type part of a name and press Enter to open Records already searching for that person.",
                "Choose Active, Archived or All to change which residents are listed.",
                "Select a resident to open the profile.",
              ]}
            />
          </Section>
          <Section title="Add or edit a resident">
            <p>
              Use the add button on the Residents tab, fill in the form, and
              save. To change details later, open the resident and choose edit.
              A resident must have complete details (birthdate, birthplace, sex,
              civil status, address and photo) before some documents can be
              issued.
            </p>
            <p>
              Names take letters only, so digits and symbols are not accepted. A
              phone number needs 7 to 13 digits, a purok is 1 to 99 and the year
              of residence runs from 1900 to this year. If you close the window
              before saving a new resident, what you typed is kept and brought
              back the next time you choose add; choose Discard draft to start
              clean.
            </p>
          </Section>
          <Section title="Archive and restore">
            <p>
              Residents who moved away or passed away should be archived, not
              deleted. Archiving asks for a reason. Choose Archived in the
              filter to find them and restore them if needed.
            </p>
          </Section>
          <Section title="Other tabs in Records Management">
            <Bullets
              items={[
                <>
                  <strong>Barangay IDs:</strong> every ID card issued, with its
                  status (Valid, Expiring soon, Expired).
                </>,
                ...(isAdmin
                  ? [
                      <>
                        <strong>Import Masterlist:</strong> bring in many
                        residents at once from a CSV, XLSX or XLS file. Follow
                        the steps shown on the page and review the results
                        before finishing.
                      </>,
                    ]
                  : []),
              ]}
            />
          </Section>
        </HelpGroup>

        <HelpGroup title="Issuing documents">
          <Section title="Create a new issuance">
            <Steps
              items={[
                "Open Issuance Management and choose New Issuance.",
                "Step 1, What are you issuing? Pick the document type.",
                "Step 2, Who is it for? Type the resident's name and pick them from the list. If they are not listed, fill in the short form to add them.",
                "If the document needs a photo, take the resident's photo in the Photo step.",
                "Fill in Document details. Fields with a red asterisk are required.",
                "Copy the ID presented and the official receipt details where asked.",
                "Check the Will print panel. When it says Ready to issue, choose Issue & print (or Issue to print later).",
              ]}
            />
          </Section>
          <Section title="Buttons at the bottom of the form">
            <Bullets
              items={[
                <>
                  <strong>Save draft &amp; close:</strong> keeps your work to
                  finish later. Drafts appear in the history with the status
                  Draft.
                </>,
                <>
                  <strong>Issue:</strong> finalizes the document and gives it a
                  reference number.
                </>,
                <>
                  <strong>Issue &amp; print:</strong> issues it and opens
                  printing right away.
                </>,
                <>
                  <strong>Cancel:</strong> closes the form. You can keep the
                  draft or discard the changes.
                </>,
              ]}
            />
          </Section>
          <Section title="Documents the system can prepare">
            <Bullets
              items={[
                <>
                  <strong>Barangay Clearance</strong> (valid for 2 months)
                </>,
                <>
                  <strong>Franchise Clearance</strong> for tricycles
                </>,
                <strong key="electrical">
                  Electrical and Water Clearance
                </strong>,
                <strong key="residency">Certification of Residency</strong>,
                <strong key="indigency">Certificate of Indigency</strong>,
                <>
                  <strong>Assistance Certification</strong> (financial, medical
                  or burial; medical also records the health condition)
                </>,
                <>
                  <strong>First-Time Jobseeker</strong> (one per resident, valid
                  for 12 months)
                </>,
                <>
                  <strong>Barangay ID</strong> (new, renewal or replacement)
                </>,
              ]}
            />
          </Section>
          <Section title="Barangay ID requirements">
            <p>
              The resident record must already have the birthdate, birthplace,
              sex, civil status, address, emergency contact (name, address and
              number) and a photo. A new card is refused if the resident already
              has a Barangay ID number. A renewal or replacement keeps the
              current number unless you type another.
            </p>
          </Section>
        </HelpGroup>

        <HelpGroup title="Printing">
          <Section title="Print a document">
            <p>
              After issuing, choose Print. Most documents print only the
              filled-in details onto the barangay's pre-printed forms, so load
              the right form in the printer first. Residency and First-Time
              Jobseeker print as full pages.
            </p>
          </Section>
          <Section title="Reprint">
            <p>
              Open Issuance Management, find the document in the history and
              choose Print again. A reprint keeps the same reference number.
            </p>
          </Section>
          <Section title="Save as PDF or Word">
            <p>
              On the screen after issuing, or in the three-dot menu of a row in
              the history, choose Save as PDF or Save as Word. The file is the
              filled form as a picture of the page, so the values cannot be
              edited in Word. Saving a copy counts as a copy in the history.
            </p>
          </Section>
          <Section title="Text does not line up with the blanks">
            <Steps
              items={[
                "On Issuance Management, choose Issuance settings, then Printing setup.",
                "Print the calibration sheet on plain paper. Set the printer to 100% scale with no headers, footers or fit-to-page.",
                "Hold the sheet against the pre-printed form and check where the red boxes land.",
                "Enter how far to shift right and down (in points), then print the sheet again until the boxes sit on the blanks.",
              ]}
            />
          </Section>
        </HelpGroup>

        <HelpGroup title="Issuance history, corrections and voiding">
          <Section title="Find an issued document">
            <p>
              The history lists every document. Search by name or reference
              number and filter by document type, status (Issued, Draft, Voided)
              and date range.
            </p>
          </Section>
          <Section title="Mistake in an issued document">
            <p>
              Issued documents are never edited directly. Choose Correct, enter
              the reason, and the system creates a correction draft with the old
              details filled in. Fix them and issue the new document. The reason
              is kept in the history.
            </p>
          </Section>
          <Section title="Void or discard">
            <Bullets
              items={[
                <>
                  <strong>Void:</strong> cancels an issued document that should
                  not be used. A reason is required and the record stays in the
                  history marked Voided.
                </>,
                <>
                  <strong>Discard:</strong> removes a draft that was never
                  issued.
                </>,
              ]}
            />
          </Section>
        </HelpGroup>

        <HelpGroup title="Activity Log">
          <p>
            The Activity Log shows who did what, when, and whether it worked
            (Success, Failed or Denied). Filter by module, outcome and date
            range.{" "}
            {isAdmin
              ? "As a System Administrator you can see everyone's activity and filter by user."
              : "You can see the activity connected to your own account."}
          </p>
        </HelpGroup>

        {isAdmin ? (
          <HelpGroup title="For System Administrators">
            <Section title="User Accounts">
              <Steps
                items={[
                  "Open User Accounts and choose Add User.",
                  "Enter the full name, email and role (System Administrator or Staff).",
                  "Give the starting password to the person in person. They must change it at first sign-in.",
                  "To stop someone from using the system, set the account to inactive instead of deleting it.",
                ]}
              />
              <p>
                Keep at least one active System Administrator at all times. The
                system will not let you remove the last one.
              </p>
            </Section>
            <Section title="Resetting a forgotten password">
              <p>
                Edit the person's account and set a new temporary password. The
                person is asked to choose their own password when they sign in.
              </p>
            </Section>
            <Section title="Officials">
              <p>
                Keep the list of barangay officials up to date. Add new
                officials with their position and term dates. When a term ends,
                use End term so the person becomes Former. Officials listed here
                appear as signatories and witnesses on documents.
              </p>
            </Section>
            <Section title="Issuance settings">
              <p>
                On Issuance Management, choose Issuance settings to change the
                lists used in forms (ID types, sectors, streets, subdivisions,
                tricycle associations, purposes, offices and educational
                attainment) and to set up Printing. Renaming an item relabels
                old documents. An item that is already used cannot be deleted.
              </p>
            </Section>
            <Section title="Management Reports">
              <p>
                Choose a report (issuances by document type, by purpose,
                expiring records, or account activity) and a period. The report
                shows on the page. Reports can be printed or saved as an Excel,
                Word, PDF or CSV file.
              </p>
            </Section>
            <Section title="Backup and Restore">
              <p>
                Choose Back up now on the Backup and Restore page. The backup is
                saved in the <code className="font-mono">backups</code> folder
                and checked. Copy backups to an external drive regularly and
                keep the encryption key and its passphrase apart from the
                computer. A restore replaces the whole database, so it is not
                run from the screen: the page checks the backup you choose and
                shows the command to run on the office computer.
              </p>
            </Section>
            <Section title="Updates">
              <p>
                The system looks for a new version and installs it at night.
                When a version is waiting, an Update reminder appears in the
                notification bell, and you can choose Update now to install it
                right away.
              </p>
            </Section>
          </HelpGroup>
        ) : null}

        <HelpGroup title="Common problems">
          <ul className="list-disc space-y-2 pl-5">
            <Problem q="I forgot my password.">
              Choose Forgot password on the sign-in page. If the office has no
              email set up, the page says so. In that case ask the System
              Administrator to set a temporary password for you.
            </Problem>
            <Problem q="It says my email or password is incorrect.">
              Check that Caps Lock is off and the email is typed in full.
              Passwords are case-sensitive. If it still fails, ask the System
              Administrator to check that your account is active.
            </Problem>
            <Problem q="A page says I have no permission.">
              That page is for System Administrators only.
            </Problem>
            <Problem q="The page will not load.">
              Check that the office computer that hosts the system is on and
              that you are connected to the office network. If it still does not
              load, tell the System Administrator.
            </Problem>
            <Problem q="Save says to correct the highlighted boxes.">
              A box has a value the system does not accept. Names take letters
              only (no digits or symbols), a phone number needs 7 to 13 digits,
              a purok is 1 to 99 and the year of residence is from 1900 to this
              year, not before the year of birth. Fix the boxes with the red
              note and save again.
            </Problem>
            <Problem q="The system says this resident may already be on record.">
              Someone with the same name and birthdate is already saved. Open
              the list and check before you add a second record. Choose Save
              anyway only when it really is a different person.
            </Problem>
            <Problem q="I was signed out.">
              The system signs you out after 30 minutes without use, and a
              sign-in lasts at most 8 hours. Sign in again. A new resident you
              were typing is kept as a draft, but an issuance in progress is not
              unless you chose Save draft and close.
            </Problem>
            <Problem q="Asked to confirm because a document was already issued today.">
              The same document for the same resident on the same day needs a
              confirmation, so it is not issued twice by accident. Confirm only
              when a second copy is really needed.
            </Problem>
            <Problem q="Where is the quick search?">
              Press Ctrl+K on any page, type part of a name and press Enter. The
              full list of shortcuts is in the Keyboard shortcuts group below.
            </Problem>
            {isAdmin ? (
              <Problem q="The backup list says a file is no longer in the backup folder.">
                Refresh the page and choose Verify once. If the notice stays,
                choose Back up now to make a new one and tell the developers the
                time the notice appeared and which backup it was.
              </Problem>
            ) : null}
            <Problem q="I cannot find a resident.">
              Try fewer words or only the last name. Check the filter is not set
              to Active when the resident was archived. If they are really not
              there, add them from the New Issuance form or Records Management.
            </Problem>
            <Problem q="The Issue button says details are missing.">
              Look for the yellow box that lists what is missing, usually the
              resident's birthdate, civil status, address or photo. Fill it in
              and try again.
            </Problem>
            <Problem q="I cannot take the resident's photo.">
              Allow the browser to use the camera when it asks. Check the camera
              is plugged in and not used by another program.
            </Problem>
            <Problem q="Printing is cut off or in the wrong place.">
              Print at 100% scale with no headers or footers, then use Printing
              setup to shift the text. Make sure the pre-printed form is loaded
              the right way round.
            </Problem>
            <Problem q="I issued the wrong document or entered a wrong detail.">
              Do not delete it. Use Correct, or Void if it should not be used,
              and then issue a new one.
            </Problem>
          </ul>
        </HelpGroup>

        <HelpGroup title="Good habits">
          <Bullets
            items={[
              "Check every detail before you issue or print.",
              "Use resident information only for barangay office work.",
              "Never share your password. Sign out when you step away.",
              "Actions such as issuing, correcting and account changes are recorded with your name and the time.",
            ]}
          />
        </HelpGroup>

        <HelpGroup title="Keyboard shortcuts">
          <ShortcutsList />
        </HelpGroup>

        <HelpGroup title="Contact the developers">
          <DeveloperContact />
        </HelpGroup>
      </HelpSearch>
    </InfoDialog>
  )
}

/* ------------------------------------------------------------------ */
/* Learn more, About, Version, Dev Note                                */
/* ------------------------------------------------------------------ */

function RoleCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2.5">
      <p className="font-semibold">{title}</p>
      <p className="mt-0.5 text-muted-foreground">{children}</p>
    </div>
  )
}

export function LearnMoreDialog(props: DialogProps) {
  return (
    <InfoDialog
      {...props}
      icon={Info}
      title="About this system"
      description={`${SITE.systemName}, ${SITE.location}`}
    >
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
        <Section title="What it is" className="md:col-span-2">
          <p>
            A staff-only system for the barangay office. It keeps resident
            records, prepares and prints documents on the barangay&apos;s
            pre-printed forms, keeps a history of everything issued, including
            Barangay ID cards, and shows summaries and reports for office use.
          </p>
        </Section>
        <Section title="What it helps you do">
          <Bullets
            items={[
              "Keep resident records in one place.",
              "Prepare and print clearances, certifications and Barangay IDs.",
              "Check which documents were issued, corrected or voided.",
              "See which clearances and IDs are about to expire.",
              "Review who did what in the system.",
            ]}
          />
        </Section>
        <Section title="What it is not">
          <p>
            It is not a public website. Residents do not have accounts, apply
            online or pay online. It does not replace documents issued by other
            agencies.
          </p>
        </Section>
        <Section title="Who can use it" className="md:col-span-2">
          <p>
            Only barangay office personnel with an account made by the System
            Administrator. There are two roles:
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <RoleCard title="Staff">
              Work with resident records, issuances and their own activity.
            </RoleCard>
            <RoleCard title="System Administrator">
              Also manages user accounts, officials, reports and backups.
            </RoleCard>
          </div>
        </Section>
        <Section title="How it runs">
          <p>
            It runs on a computer in the barangay office and is used over the
            office network. It does not need the internet. Resident data and
            photos stay on that computer and are not uploaded online.
          </p>
        </Section>
        <Section title="Your records are protected">
          <Bullets
            items={[
              "Every sign-in needs an email and password. Do not share yours.",
              "Issuing, correcting and account changes are recorded with your name and the time.",
              "Issued documents are not edited directly. Corrections are made with a reason and kept in the history.",
            ]}
          />
          <p>
            Read the Terms of Use and the Privacy Policy at the bottom of the
            page for the full rules.
          </p>
        </Section>
        <Section title="Built by" className="md:col-span-2">
          <p>{SITE.developedBy}.</p>
        </Section>
      </div>
    </InfoDialog>
  )
}

export function VersionDialog(props: DialogProps) {
  const known = __APP_COMMIT__ !== "unknown"
  return (
    <InfoDialog
      {...props}
      icon={Tag}
      size="md"
      title="Version"
      description={SITE.systemName}
    >
      <dl className="divide-y rounded-lg border">
        <div className="grid grid-cols-[6rem_1fr] gap-x-4 px-3 py-2.5">
          <dt className="text-muted-foreground">Version</dt>
          <dd className="font-medium">{__APP_VERSION__}</dd>
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-x-4 px-3 py-2.5">
          <dt className="text-muted-foreground">Release</dt>
          <dd className="min-w-0 font-medium">
            {known ? (
              <span className="font-mono" data-testid="version-commit">
                {__APP_COMMIT__}
              </span>
            ) : (
              "Development copy (not an installed release)"
            )}
            {known && __APP_RELEASED__ ? (
              <span className="font-normal text-muted-foreground">
                {" "}
                · saved {__APP_RELEASED__}
              </span>
            ) : null}
          </dd>
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-x-4 px-3 py-2.5">
          <dt className="text-muted-foreground">Built on</dt>
          <dd className="font-medium">{__BUILD_DATE__}</dd>
        </div>
        <div className="grid grid-cols-[6rem_1fr] gap-x-4 px-3 py-2.5">
          <dt className="text-muted-foreground">Developed by</dt>
          <dd className="font-medium">{SITE.developedBy}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">
        The release code changes every time the system is updated on this
        computer. Quote it when you report a problem.
      </p>
    </InfoDialog>
  )
}

export function AboutDialog(props: DialogProps) {
  return (
    <InfoDialog
      {...props}
      icon={Info}
      title="About this system"
      description={SITE.systemName}
    >
      <Section title="What it is">
        <p>
          A records and document issuance system for {SITE.fullName},{" "}
          {SITE.location}. It replaces retyping the same resident details on
          every form with one record that is filled in once and reused.
        </p>
      </Section>
      <Section title="What it does">
        <Bullets
          items={[
            "Keeps resident records, with search and import of the barangay's existing masterlist.",
            "Prepares and prints barangay documents such as clearances, certificates and Barangay IDs on the office's own forms, and keeps a history with issue and expiry dates.",
            "Shows what was issued, what is about to expire, and what needs attention, with reports for the barangay officials.",
            "Records who did what, and takes backups of the data.",
          ]}
        />
      </Section>
      <Section title="Who it is for">
        <p>
          Barangay office personnel only. Accounts are created by the System
          Administrator; there is no public sign-up and residents do not sign
          in.
        </p>
      </Section>
      <Section title="Where the data lives">
        <p>
          The system runs on a computer in the barangay office and is opened
          from other office computers over the local network. It does not need
          the internet, and resident information stays in the office.
        </p>
      </Section>
      <Section title="What it does not do">
        <p>
          It does not sign or stamp documents; the Punong Barangay's signature
          and the dry seal stay manual. It is a separate system and is not
          connected to LGUSS-BIMS.
        </p>
      </Section>
      <Section title="Who made it">
        <p>
          Built for {SITE.fullName} by students of {SITE.developedBy}. See the
          Dev Note in the footer for the story.
        </p>
      </Section>
    </InfoDialog>
  )
}

function PersonList({ people }: { people: readonly DevNotePerson[] }) {
  return (
    <ul className="space-y-2">
      {people.map((person) => (
        <li key={person.name} className="rounded-lg border bg-card px-3 py-2.5">
          <p className="font-semibold">{person.name}</p>
          <p className="text-xs text-muted-foreground">{person.role}</p>
          <p className="mt-1">{person.contribution}</p>
          {person.github ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {person.github}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function DevNoteDialog(props: DialogProps) {
  return (
    <InfoDialog
      {...props}
      icon={MessageSquareText}
      title="Dev Note"
      description="The story behind the system"
    >
      <Section title="How it started">
        <p>
          This system began as a class project and became something more. Our
          instructors assigned us a real client, {SITE.fullName}, and on October
          19 and 20, 2026 we went to the barangay to interview the people who do
          this work every day. We asked how a document is prepared today, what
          slows them down, and what a system would have to do before they could
          trust it.
        </p>
      </Section>
      <Section title="What we promised">
        <p>
          We wrote the Creative Brief from those interviews, and our professor
          signed it. We chose to build a few things that fully work instead of
          many things that half work: resident records, document issuance and
          printing, the issuance history, and backup and restore. We also
          promised never to invent what the barangay had not told us, so
          anything we were unsure about stayed a question for the client.
        </p>
      </Section>
      <Section title="How we built it">
        <p>
          We built it to run in the barangay office with no internet, because
          that is what the office asked for. Documents are printed onto the
          barangay's own forms, every change to a record is written down so it
          can be reviewed later, and resident information is treated as
          sensitive: we used made-up data for every test and demo.
        </p>
      </Section>
      <Section title="The team">
        <PersonList people={DEV_TEAM} />
      </Section>
      <Section title="Those who guided us">
        <PersonList people={DEV_GUIDES} />
        <p>
          Thank you also to the officials and staff of {SITE.fullName}, who gave
          their time, showed us their real forms and told us what the work is
          really like.
        </p>
      </Section>
      <Section title="A last word">
        <p>
          Thank you for using the system. If something is wrong or missing, tell
          the System Administrator, so the next version can be better. Open Get
          help in the profile menu to see how to reach the developers.
        </p>
      </Section>
    </InfoDialog>
  )
}
