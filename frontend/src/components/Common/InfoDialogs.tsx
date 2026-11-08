import type { ReactNode } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { SITE } from "@/config/site"
import useAuth from "@/hooks/useAuth"
import { isSystemAdministrator } from "@/lib/access"
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

/** A collapsible group so the long help text stays easy to scan. */
function HelpGroup({
  title,
  children,
  defaultOpen = false,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border bg-card px-3 py-2 open:pb-3"
    >
      <summary className="cursor-pointer select-none py-1 font-semibold marker:text-muted-foreground">
        {title}
      </summary>
      <div className="mt-2 space-y-3">{children}</div>
    </details>
  )
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-1 pl-5">
      {items.map((item, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: static help text
        <li key={index}>{item}</li>
      ))}
    </ol>
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
      title="Keyboard shortcuts"
      description="Shortcuts do not work while you are typing in a box."
    >
      <ShortcutsList />
    </InfoDialog>
  )
}

export function HelpDialog(props: DialogProps) {
  const { user } = useAuth()
  const isAdmin = isSystemAdministrator(user)

  return (
    <InfoDialog
      {...props}
      title="Get help"
      description="Short guides for everyday office work. Everything here works without an internet connection."
    >
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
            If the System Administrator gave you a temporary password, the system
            asks you to set a new one before you continue. The new password must
            have at least 12 characters. After saving it, sign in again with the
            new password.
          </p>
        </Section>
        <Section title="Signing out">
          <p>
            Open the profile menu (your name) and choose Logout. Always sign out
            when you leave the computer.
          </p>
        </Section>
        <Section title="Your account and the profile menu">
          <p>
            The profile menu has My Account (your details, photo and password),
            Language, Get help, Learn more and Logout.
          </p>
        </Section>
        <Section title="What each person can see">
          <p>
            Staff use the Dashboard, Activity Log, Issuance Management and
            Records Management. Officials, User Accounts, Management Reports and
            Backup and Restore are for System Administrators only.
          </p>
        </Section>
      </HelpGroup>

      <HelpGroup title="Dashboard">
        <p>
          The Dashboard is the first page after you sign in. Use the Period
          menu (Today, This Week, This Month, Past 3 Months, Past 6 Months, This
          Year, Overall) to change the numbers.
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Documents Issued This Month:</strong> how many documents the
            office issued.
          </li>
          <li>
            <strong>Clearances and Barangay IDs expiring in 30 days:</strong>{" "}
            records that will need renewing soon.
          </li>
          <li>
            <strong>Pending Document Requests:</strong> drafts that were started
            but not yet issued.
          </li>
          <li>
            <strong>Quick Actions:</strong> shortcuts to find a resident, create
            an issuance or review history.
          </li>
        </ul>
      </HelpGroup>

      <HelpGroup title="Finding and managing residents">
        <Section title="Find a resident">
          <Steps
            items={[
              "Open Records Management.",
              "Type a name, address or ID number in the search box. Press / to jump to it.",
              "Choose Active, Archived or All to change which residents are listed.",
              "Select a resident to open the profile.",
            ]}
          />
        </Section>
        <Section title="Add or edit a resident">
          <p>
            Use the add button on the Residents tab, fill in the form, and save.
            To change details later, open the resident and choose edit. A
            resident must have complete details (birthdate, birthplace, sex,
            civil status, address and photo) before some documents can be
            issued.
          </p>
        </Section>
        <Section title="Archive and restore">
          <p>
            Residents who moved away or passed away should be archived, not
            deleted. Archiving asks for a reason. Choose Archived in the filter
            to find them and restore them if needed.
          </p>
        </Section>
        <Section title="Other tabs in Records Management">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Barangay IDs:</strong> every ID card issued, with its
              status (Valid, Expiring soon, Expired).
            </li>
            <li>
              <strong>Family &amp; Sector Details:</strong> family and
              marginalized-sector information linked to residents.
            </li>
            {isAdmin ? (
              <>
                <li>
                  <strong>Lookup Lists:</strong> the streets, associations and
                  similar choices that appear in forms.
                </li>
                <li>
                  <strong>Import Masterlist:</strong> bring in many residents at
                  once from a CSV, XLSX or XLS file. Follow the steps shown on
                  the page and review the results before finishing.
                </li>
              </>
            ) : null}
          </ul>
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
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Save draft &amp; close:</strong> keeps your work to finish
              later. Drafts appear in the history with the status Draft.
            </li>
            <li>
              <strong>Issue:</strong> finalizes the document and gives it a
              reference number.
            </li>
            <li>
              <strong>Issue &amp; print:</strong> issues it and opens printing
              right away.
            </li>
            <li>
              <strong>Cancel:</strong> closes the form. You can keep the draft or
              discard the changes.
            </li>
          </ul>
        </Section>
        <Section title="Documents the system can prepare">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Barangay Clearance</strong> (valid for 2 months)
            </li>
            <li>
              <strong>Franchise Clearance</strong> for tricycles
            </li>
            <li>
              <strong>Electrical and Water Clearance</strong>
            </li>
            <li>
              <strong>Certification of Residency</strong>
            </li>
            <li>
              <strong>Certificate of Indigency</strong>
            </li>
            <li>
              <strong>Assistance Certification</strong> (financial, medical or
              burial)
            </li>
            <li>
              <strong>Marginalized Sector (Pagpapatunay)</strong>
            </li>
            <li>
              <strong>First-Time Jobseeker</strong> (one per resident, valid for
              12 months)
            </li>
            <li>
              <strong>Barangay ID</strong> (new, renewal or replacement)
            </li>
          </ul>
        </Section>
        <Section title="Barangay ID requirements">
          <p>
            The resident record must already have the birthdate, birthplace, sex,
            civil status, address, emergency contact (name, address and number)
            and a photo. A new card is refused if the resident already has a
            Barangay ID number. A renewal or replacement keeps the current number
            unless you type another.
          </p>
        </Section>
      </HelpGroup>

      <HelpGroup title="Printing">
        <Section title="Print a document">
          <p>
            After issuing, choose Print. Most documents print only the filled-in
            details onto the barangay's pre-printed forms, so load the right form
            in the printer first. Residency, Marginalized Sector and First-Time
            Jobseeker print as full pages.
          </p>
        </Section>
        <Section title="Reprint">
          <p>
            Open Issuance Management, find the document in the history and choose
            Print again. A reprint keeps the same reference number.
          </p>
        </Section>
        <Section title="Text does not line up with the blanks">
          <Steps
            items={[
              "On Issuance Management, choose Printing setup.",
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
            The history lists every document. Search by name or reference number
            and filter by document type, status (Issued, Draft, Voided) and date
            range.
          </p>
        </Section>
        <Section title="Mistake in an issued document">
          <p>
            Issued documents are never edited directly. Choose Correct, enter the
            reason, and the system creates a correction draft with the old
            details filled in. Fix them and issue the new document. The reason is
            kept in the history.
          </p>
        </Section>
        <Section title="Void or discard">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Void:</strong> cancels an issued document that should not
              be used. A reason is required and the record stays in the history
              marked Voided.
            </li>
            <li>
              <strong>Discard:</strong> removes a draft that was never issued.
            </li>
          </ul>
        </Section>
      </HelpGroup>

      <HelpGroup title="Activity Log">
        <p>
          The Activity Log shows who did what, when, and whether it worked
          (Success, Failed or Denied). Filter by module, outcome and date range.{" "}
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
                "Enter the full name, email, role (System Administrator or Staff) and a temporary password.",
                "Give the temporary password to the person in person. They must change it at first sign-in.",
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
              Keep the list of barangay officials up to date. Add new officials
              with their position and term dates. When a term ends, use End term
              so the person becomes Former. Officials listed here appear as
              signatories and witnesses on documents.
            </p>
          </Section>
          <Section title="Management Reports">
            <p>
              Choose a report (issuances by document type, by purpose, expiring
              records, or account activity) and a period, then choose Preview.
              Reports can be downloaded as a CSV file.
            </p>
          </Section>
          <Section title="Backup and Restore">
            <p>
              The buttons on this page do not back up data yet. To back up the
              database, open PowerShell in the project folder and run{" "}
              <code className="font-mono">.\scripts\backup-db.ps1</code>. The
              file is saved in the <code className="font-mono">backups</code>{" "}
              folder. Copy it to an external drive regularly.
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
            Check that Caps Lock is off and the email is typed in full. Passwords
            are case-sensitive. If it still fails, ask the System Administrator
            to check that your account is active.
          </Problem>
          <Problem q="A page says I have no permission.">
            That page is for System Administrators only.
          </Problem>
          <Problem q="The page will not load.">
            Check that the office computer that hosts the system is on and that
            you are connected to the office network. If it still does not load,
            tell the System Administrator.
          </Problem>
          <Problem q="I cannot find a resident.">
            Try fewer words or only the last name. Check the filter is not set to
            Active when the resident was archived. If they are really not
            there, add them from the New Issuance form or Records Management.
          </Problem>
          <Problem q="The Issue button says details are missing.">
            Look for the yellow box that lists what is missing, usually the
            resident's birthdate, civil status, address or photo. Fill it in and
            try again.
          </Problem>
          <Problem q="I cannot take the resident's photo.">
            Allow the browser to use the camera when it asks. Check the camera is
            plugged in and not used by another program.
          </Problem>
          <Problem q="Printing is cut off or in the wrong place.">
            Print at 100% scale with no headers or footers, then use Printing
            setup to shift the text. Make sure the pre-printed form is loaded the
            right way round.
          </Problem>
          <Problem q="I issued the wrong document or entered a wrong detail.">
            Do not delete it. Use Correct, or Void if it should not be used, and
            then issue a new one.
          </Problem>
        </ul>
      </HelpGroup>

      <HelpGroup title="Good habits">
        <ul className="list-disc space-y-1 pl-5">
          <li>Check every detail before you issue or print.</li>
          <li>Use resident information only for barangay office work.</li>
          <li>Never share your password. Sign out when you step away.</li>
          <li>
            Actions such as issuing, correcting and account changes are recorded
            with your name and the time.
          </li>
        </ul>
      </HelpGroup>

      <HelpGroup title="Keyboard shortcuts">
        <ShortcutsList />
      </HelpGroup>

      <Section title="Who to contact">
        <p>
          Ask your System Administrator at the barangay office. Tell them the
          page you were on, what you clicked, and any message you saw.
        </p>
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
