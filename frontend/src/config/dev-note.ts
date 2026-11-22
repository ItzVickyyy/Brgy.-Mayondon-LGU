/**
 * People named in the "Dev Note" popup. Everything here comes from the project documents
 * (README.md, docs/01-Project-and-Schedule.md). Edit this file to add a person or change a role;
 * the popup in components/Common/InfoDialogs.tsx reads it and nothing else needs to change.
 */
export type DevNotePerson = {
  name: string
  role: string
  /** One plain sentence about what this person did for the system. */
  contribution: string
}

export const DEV_TEAM: readonly DevNotePerson[] = [
  {
    name: "Vic John O. Salen Jr.",
    role: "Project Leader, Full Stack Developer",
    contribution:
      "Held the project together: architecture, sign-in and roles, deployment to the office computer, and the final demo.",
  },
  {
    name: "Justin Adrian P. Reboton",
    role: "Backend Developer, Technical Writer",
    contribution:
      "Built the server side (records, migrations, APIs, tests) and wrote the Creative Brief, the manual and the reports.",
  },
  {
    name: "Jean Mervin G. Fajardo",
    role: "Full Stack Developer",
    contribution:
      "Shaped how the system looks and feels: layouts, mobile screens and the links between the screens and the server.",
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
