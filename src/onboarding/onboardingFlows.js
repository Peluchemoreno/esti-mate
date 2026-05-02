export const ONBOARDING_FLOW_ID = "gutter_first_estimate";

export const FIRST_ESTIMATE_STEPS = [
  {
    id: "start_job",
    eventName: "project_created",
    label: "Start your first job",
    description:
      "Create a job so you have a place to save diagrams and estimates.",
    actionText: "Create job",
    route: "/dashboard/projects",
    target: "create-project-button",
  },
  {
    id: "open_diagram",
    eventName: "diagram_opened",
    label: "Open the drawing tool",
    description: "Open the job and start the diagram.",
    actionText: "Open drawing tool",
    route: "/dashboard/projects",
    target: "open-diagram-button",
  },
  {
    id: "save_diagram",
    eventName: "diagram_saved",
    label: "Save a gutter diagram",
    description: "Draw at least one gutter run and save the diagram.",
    actionText: "Save diagram",
    route: "/dashboard/projects",
    target: "diagram-save-button",
  },
  {
    id: "create_estimate",
    eventName: "estimate_created",
    label: "Create a customer-ready estimate",
    description: "Review the estimate and save it for the customer.",
    actionText: "Create estimate",
    route: "/dashboard/projects",
    target: "save-estimate-button",
  },
];

export function getFirstIncompleteStep(completedStepIds = []) {
  const completed = new Set(completedStepIds);
  return FIRST_ESTIMATE_STEPS.find((step) => !completed.has(step.id)) || null;
}
