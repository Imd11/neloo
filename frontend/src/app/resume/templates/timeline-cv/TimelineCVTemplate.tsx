import { useCallback } from "react";
import type { ResumeData, StyleSettings } from "../../types/resume";
import { darkenColor } from "../../utils/colorUtils";
import { EditableText } from "../../components/EditableText";
import { getLabel } from "../../lib/i18n/resumeLabels";
import "./TimelineCV.css";

interface Props {
  data: ResumeData;
  style: StyleSettings;
  onDataChange?: (data: ResumeData) => void;
}

export function TimelineCVTemplate({ data, style, onDataChange }: Props) {
  const { personal, experience, education, skills, languages, awards } = data;
  const visibility = data.sectionVisibility;
  const showAwards = visibility?.awards ?? (awards?.length ?? 0) > 0;
  const lang = style.resumeLanguage || "en";

  const cssVars = {
    "--primary-color": style.primaryColor,
    "--primary-dark": darkenColor(style.primaryColor, 15),
    "--font-size": `${style.fontSize}pt`,
    "--line-height": style.lineHeight,
    "--sidebar-width": `${style.sidebarWidth}%`,
    "--scale": style.fontSize / 10,
  } as React.CSSProperties;

  // Helper function for updating personal data
  const updatePersonal = useCallback(
    (field: string, value: string) => {
      if (onDataChange) {
        onDataChange({
          ...data,
          personal: { ...data.personal, [field]: value },
        });
      }
    },
    [data, onDataChange]
  );

  const updateExperience = useCallback(
    (index: number, field: string, value: string) => {
      if (onDataChange) {
        const newExp = [...data.experience];
        newExp[index] = { ...newExp[index], [field]: value };
        onDataChange({ ...data, experience: newExp });
      }
    },
    [data, onDataChange]
  );

  const updateEducation = useCallback(
    (index: number, field: string, value: string) => {
      if (onDataChange) {
        const newEdu = [...data.education];
        newEdu[index] = { ...newEdu[index], [field]: value };
        onDataChange({ ...data, education: newEdu });
      }
    },
    [data, onDataChange]
  );

  const updateSkill = useCallback(
    (index: number, field: string, value: string) => {
      if (onDataChange) {
        const newSkills = [...data.skills];
        newSkills[index] = { ...newSkills[index], [field]: value };
        onDataChange({ ...data, skills: newSkills });
      }
    },
    [data, onDataChange]
  );

  const updateLanguage = useCallback(
    (index: number, field: string, value: string) => {
      if (onDataChange) {
        const newLangs = [...data.languages];
        newLangs[index] = { ...newLangs[index], [field]: value };
        onDataChange({ ...data, languages: newLangs });
      }
    },
    [data, onDataChange]
  );

  const updateAward = useCallback(
    (index: number, field: string, value: string) => {
      if (onDataChange) {
        const newAwards = [...data.awards];
        newAwards[index] = { ...newAwards[index], [field]: value };
        onDataChange({ ...data, awards: newAwards });
      }
    },
    [data, onDataChange]
  );

  const updateHighlight = useCallback(
    (expIndex: number, highlightIndex: number, value: string) => {
      if (onDataChange) {
        const newExp = [...data.experience];
        const newHighlights = [...(newExp[expIndex].highlights || [])];
        newHighlights[highlightIndex] = value;
        newExp[expIndex] = { ...newExp[expIndex], highlights: newHighlights };
        onDataChange({ ...data, experience: newExp });
      }
    },
    [data, onDataChange]
  );

  return (
    <div
      className="timeline-container"
      style={cssVars}
    >
      {/* Left Sidebar */}
      <aside className="timeline-sidebar">
        {/* Profile */}
        <div className="timeline-profile">
          {personal.photo && (
            <img
              src={personal.photo}
              alt=""
              className="timeline-photo"
            />
          )}
          <EditableText
            tag="h1"
            className="timeline-name"
            value={personal.name || ""}
            onChange={
              onDataChange ? (v) => updatePersonal("name", v) : undefined
            }
            placeholder="Your Name"
          />
          <EditableText
            tag="p"
            className="timeline-title"
            value={personal.title || ""}
            onChange={
              onDataChange ? (v) => updatePersonal("title", v) : undefined
            }
            placeholder="Adventurer"
          />
        </div>

        {/* Contact */}
        <section className="timeline-section">
          <div className="timeline-contact-list">
            {(personal.address || onDataChange) && (
              <div className="timeline-contact-item">
                <span className="timeline-contact-icon">📍</span>
                <EditableText
                  tag="span"
                  value={personal.address || ""}
                  onChange={
                    onDataChange
                      ? (v) => updatePersonal("address", v)
                      : undefined
                  }
                  placeholder="Address"
                />
              </div>
            )}
            {(personal.phone || onDataChange) && (
              <div className="timeline-contact-item">
                <span className="timeline-contact-icon">📞</span>
                <EditableText
                  tag="span"
                  value={personal.phone || ""}
                  onChange={
                    onDataChange ? (v) => updatePersonal("phone", v) : undefined
                  }
                  placeholder="Phone"
                />
              </div>
            )}
            {(personal.website || onDataChange) && (
              <div className="timeline-contact-item">
                <span className="timeline-contact-icon">🔗</span>
                <EditableText
                  tag="span"
                  value={personal.website || ""}
                  onChange={
                    onDataChange
                      ? (v) => updatePersonal("website", v)
                      : undefined
                  }
                  placeholder="Website"
                />
              </div>
            )}
            {(personal.email || onDataChange) && (
              <div className="timeline-contact-item">
                <span className="timeline-contact-icon">✉️</span>
                <EditableText
                  tag="span"
                  value={personal.email || ""}
                  onChange={
                    onDataChange ? (v) => updatePersonal("email", v) : undefined
                  }
                  placeholder="Email"
                />
              </div>
            )}
          </div>
        </section>

        {/* Profile Summary */}
        <section className="timeline-section">
          <h2 className="timeline-section-title">
            {getLabel("summary", lang)}
          </h2>
          <EditableText
            tag="p"
            className="timeline-profile-text"
            value={personal.summary || ""}
            onChange={
              onDataChange ? (v) => updatePersonal("summary", v) : undefined
            }
            placeholder="Your professional summary"
          />
        </section>

        {/* Other Interest */}
        {showAwards && awards && awards.length > 0 && (
          <section className="timeline-section">
            <h2 className="timeline-section-title">
              {getLabel("interests", lang)}
            </h2>
            <div className="timeline-interest-text">
              {awards.map((award, i) => (
                <span key={award.id || i}>
                  <EditableText
                    tag="span"
                    value={award.title || ""}
                    onChange={
                      onDataChange
                        ? (v) => updateAward(i, "title", v)
                        : undefined
                    }
                    placeholder="Interest"
                  />
                  {i < awards.length - 1 && ". "}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Skills */}
        {skills.length > 0 && (
          <section className="timeline-section">
            <h2 className="timeline-section-title">
              {getLabel("skills", lang)}
            </h2>
            <div className="timeline-skills-list">
              {skills.map((skill, i) => (
                <div
                  key={skill.id || i}
                  className="timeline-skill-item"
                >
                  <EditableText
                    tag="span"
                    className="timeline-skill-name"
                    value={skill.name || ""}
                    onChange={
                      onDataChange
                        ? (v) => updateSkill(i, "name", v)
                        : undefined
                    }
                    placeholder="Skill"
                  />
                  <div className="timeline-skill-bar">
                    <div
                      className="timeline-skill-fill"
                      style={{ width: `${(skill.level || 3) * 20}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Languages */}
        {languages.length > 0 && (
          <section className="timeline-section">
            <h2 className="timeline-section-title">
              {getLabel("languages", lang)}
            </h2>
            <div className="timeline-languages">
              {languages.map((langItem, i) => (
                <div
                  key={langItem.id || i}
                  className="timeline-language-item"
                >
                  <EditableText
                    tag="span"
                    className="timeline-lang-name"
                    value={langItem.name || ""}
                    onChange={
                      onDataChange
                        ? (v) => updateLanguage(i, "name", v)
                        : undefined
                    }
                    placeholder="Language"
                  />
                  <EditableText
                    tag="span"
                    className="timeline-lang-level"
                    value={langItem.level || ""}
                    onChange={
                      onDataChange
                        ? (v) => updateLanguage(i, "level", v)
                        : undefined
                    }
                    placeholder="Level"
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </aside>

      {/* Main Content */}
      <main className="timeline-main">
        {/* Experience Section */}
        {experience.length > 0 && (
          <section className="timeline-main-section">
            <h2 className="timeline-main-title">
              {getLabel("experience", lang)}
            </h2>
            <div className="timeline-entries">
              {experience.map((exp, i) => (
                <div
                  key={exp.id || i}
                  className="timeline-entry"
                >
                  <div className="timeline-date-col">
                    <div className="timeline-date-present">
                      {exp.current ? (
                        "Present"
                      ) : (
                        <EditableText
                          tag="span"
                          value={exp.endDate || ""}
                          onChange={
                            onDataChange
                              ? (v) => updateExperience(i, "endDate", v)
                              : undefined
                          }
                          placeholder="End"
                        />
                      )}
                    </div>
                    <div className="timeline-date-range">
                      <EditableText
                        tag="span"
                        value={exp.startDate || ""}
                        onChange={
                          onDataChange
                            ? (v) => updateExperience(i, "startDate", v)
                            : undefined
                        }
                        placeholder="Start"
                      />
                    </div>
                  </div>
                  <div className="timeline-dot-col">
                    <div className="timeline-dot" />
                    <div className="timeline-line" />
                  </div>
                  <div className="timeline-content-col">
                    <div className="timeline-entry-header">
                      <EditableText
                        tag="span"
                        className="timeline-job-title"
                        value={exp.position || ""}
                        onChange={
                          onDataChange
                            ? (v) => updateExperience(i, "position", v)
                            : undefined
                        }
                        placeholder="Position"
                      />
                      <EditableText
                        tag="span"
                        className="timeline-company"
                        value={exp.company || ""}
                        onChange={
                          onDataChange
                            ? (v) => updateExperience(i, "company", v)
                            : undefined
                        }
                        placeholder="Company"
                      />
                    </div>
                    <EditableText
                      tag="p"
                      className="timeline-desc"
                      value={exp.description || ""}
                      onChange={
                        onDataChange
                          ? (v) => updateExperience(i, "description", v)
                          : undefined
                      }
                      placeholder="Description"
                    />
                    {exp.highlights && exp.highlights.length > 0 && (
                      <ul className="timeline-desc-list">
                        {exp.highlights.map((h, j) => (
                          <li key={j}>
                            <EditableText
                              tag="span"
                              value={h || ""}
                              onChange={
                                onDataChange
                                  ? (v) => updateHighlight(i, j, v)
                                  : undefined
                              }
                              placeholder="Highlight"
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Education Section */}
        {education.length > 0 && (
          <section className="timeline-main-section">
            <h2 className="timeline-main-title">
              {getLabel("education", lang)}
            </h2>
            <div className="timeline-entries">
              {education.map((edu, i) => (
                <div
                  key={edu.id || i}
                  className="timeline-entry"
                >
                  <div className="timeline-date-col">
                    <div className="timeline-date-present">
                      <EditableText
                        tag="span"
                        value={edu.endDate || ""}
                        onChange={
                          onDataChange
                            ? (v) => updateEducation(i, "endDate", v)
                            : undefined
                        }
                        placeholder="End"
                      />
                    </div>
                    <div className="timeline-date-range">
                      <EditableText
                        tag="span"
                        value={edu.startDate || ""}
                        onChange={
                          onDataChange
                            ? (v) => updateEducation(i, "startDate", v)
                            : undefined
                        }
                        placeholder="Start"
                      />
                    </div>
                  </div>
                  <div className="timeline-dot-col">
                    <div className="timeline-dot" />
                    <div className="timeline-line" />
                  </div>
                  <div className="timeline-content-col">
                    <div className="timeline-entry-header">
                      <EditableText
                        tag="span"
                        className="timeline-job-title"
                        value={edu.degree || ""}
                        onChange={
                          onDataChange
                            ? (v) => updateEducation(i, "degree", v)
                            : undefined
                        }
                        placeholder="Degree"
                      />
                      <EditableText
                        tag="span"
                        className="timeline-company"
                        value={edu.institution || ""}
                        onChange={
                          onDataChange
                            ? (v) => updateEducation(i, "institution", v)
                            : undefined
                        }
                        placeholder="Institution"
                      />
                    </div>
                    {(edu.field || onDataChange) && (
                      <EditableText
                        tag="p"
                        className="timeline-field"
                        value={edu.field || ""}
                        onChange={
                          onDataChange
                            ? (v) => updateEducation(i, "field", v)
                            : undefined
                        }
                        placeholder="Field of study"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Awards Section */}
        {showAwards && awards && awards.length > 0 && (
          <section className="timeline-main-section">
            <h2 className="timeline-main-title">{getLabel("awards", lang)}</h2>
            <div className="timeline-awards">
              {awards.map((award, i) => (
                <div
                  key={award.id || i}
                  className="timeline-award-item"
                >
                  <EditableText
                    tag="span"
                    className="timeline-award-year"
                    value={award.date || ""}
                    onChange={
                      onDataChange
                        ? (v) => updateAward(i, "date", v)
                        : undefined
                    }
                    placeholder="Year"
                  />
                  <div className="timeline-award-content">
                    <EditableText
                      tag="span"
                      className="timeline-award-title"
                      value={award.title || ""}
                      onChange={
                        onDataChange
                          ? (v) => updateAward(i, "title", v)
                          : undefined
                      }
                      placeholder="Award"
                    />
                    <EditableText
                      tag="p"
                      value={award.description || ""}
                      onChange={
                        onDataChange
                          ? (v) => updateAward(i, "description", v)
                          : undefined
                      }
                      placeholder="Description"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default TimelineCVTemplate;
