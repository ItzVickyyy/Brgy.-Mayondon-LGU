/**
 * People named in the "Dev Note" and "Get help" popups. Everything here comes from the project documents
 * (README.md, docs/01-Project-and-Schedule.md). Edit this file to add a person or change a role;
 * the popups in components/Common/InfoDialogs.tsx read it and nothing else needs to change.
 */
export type DevNotePerson = {
  name: string
  role: string
  /** One plain sentence about what this person did for the system. */
  contribution: string
  /** GitHub handle without the address, shown as plain text (the office has no internet). */
  github?: string
}

/**
 * How to reach the developers. Leave a value as `null` until it is confirmed: the Get help popup
 * shows only the lines that have a value, so nothing is shown for the missing ones.
 */
export const DEV_CONTACT: {
  email: string | null
  phone: string | null
  hours: string | null
} = {
  email: null,
  phone: null,
  hours: null,
}

export const DEV_TEAM: readonly DevNotePerson[] = [
  {
    name: "Vic John O. Salen Jr.",
    role: "Project Leader, Full Stack Developer",
    contribution:
      "Held the project together: architecture, sign-in and roles, deployment to the office computer, and the final demo.",
    github: "github.com/ItzVickyyy",
  },
  {
    name: "Justin Adrian P. Reboton",
    role: "Backend Developer, Technical Writer",
    contribution:
      "Built the server side (records, migrations, APIs, tests) and wrote the Creative Brief, the manual and the reports.",
    github: "github.com/jOstin-7",
  },
  {
    name: "Jean Mervin G. Fajardo",
    role: "Full Stack Developer",
    contribution:
      "Shaped how the system looks and feels: layouts, mobile screens and the links between the screens and the server.",
    github: "github.com/JeanMervin",
  },
]

export const DEV_GUIDES: readonly DevNotePerson[] = [
  {
    name: "Prof. Merardo Arenas Camba, Jr.",
    role: "Principles of Web Design (ITST301)",
    contribution:
      "Assigned us to Barangay Mayondon, guided the client interviews and the Creative Brief, and signed it.",
  },
  {
    name: "Sir Mike Philip Ramos",
    role: "Integrative Programming and Networking 2",
    contribution:
      "Guided the back end, the database and how the system behaves on the office network.",
  },
  {
    name: "Sir Alejandro V. Matute Jr.",
    role: "Client-Server Technologies",
    contribution:
      "Guided how the browser, the server and the database talk to each other and how the system is set up.",
  },
]
