class Resume {
  name string
  title string? @description("Job title, if mentioned")
  company string? @description("Current or most recent company")
  skills string[] @description("Technical skills mentioned")
  education string? @description("Education background")
}

function ExtractResume(resume_text: string) -> Resume {
  client GPT4o
  prompt #"
    Extract structured resume information from the following text.
    Return a Resume object with the extracted fields.

    Resume text:
    {{ resume_text }}
  "#
}