import { useCallback } from 'react';
import type { ResumeData, StyleSettings } from '../../types/resume';
import { darkenColor } from '../../utils/colorUtils';
import { EditableText } from '../../components/EditableText';
import { getLabel } from '../../lib/i18n/resumeLabels';
import './ClassicCV.css';

interface Props {
    data: ResumeData;
    style: StyleSettings;
    onDataChange?: (data: ResumeData) => void;
}

export function ClassicCVTemplate({ data, style, onDataChange }: Props) {
    const { personal, experience, education, skills, languages, certificates } = data;
    const visibility = data.sectionVisibility;
    const showCertificates = visibility?.certificates ?? (certificates?.length ?? 0) > 0;
    const showHobbies = visibility?.hobbies ?? (data.hobbies?.length ?? 0) > 0;
    const lang = style.resumeLanguage || 'en';

    const cssVars = {
        '--primary-color': style.primaryColor,
        '--primary-dark': darkenColor(style.primaryColor, 15),
        '--font-size': `${style.fontSize}pt`,
        '--line-height': style.lineHeight,
        '--sidebar-width': `${style.sidebarWidth}%`,
        '--scale': style.fontSize / 10,
    } as React.CSSProperties;

    // Helper functions for updating data
    const updatePersonal = useCallback((field: string, value: string) => {
        if (onDataChange) {
            onDataChange({
                ...data,
                personal: { ...data.personal, [field]: value },
            });
        }
    }, [data, onDataChange]);

    const updateExperience = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newExp = [...data.experience];
            newExp[index] = { ...newExp[index], [field]: value };
            onDataChange({ ...data, experience: newExp });
        }
    }, [data, onDataChange]);

    const updateEducation = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newEdu = [...data.education];
            newEdu[index] = { ...newEdu[index], [field]: value };
            onDataChange({ ...data, education: newEdu });
        }
    }, [data, onDataChange]);

    const updateSkill = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newSkills = [...data.skills];
            newSkills[index] = { ...newSkills[index], [field]: value };
            onDataChange({ ...data, skills: newSkills });
        }
    }, [data, onDataChange]);

    const updateLanguage = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newLangs = [...data.languages];
            newLangs[index] = { ...newLangs[index], [field]: value };
            onDataChange({ ...data, languages: newLangs });
        }
    }, [data, onDataChange]);

    return (
        <div className="classic-container" style={cssVars}>
            {/* Sidebar */}
            <aside className="classic-sidebar">
                {/* Name */}
                <div className="classic-name-section">
                    {personal.photo && (
                        <img src={personal.photo} alt="" className="classic-photo" />
                    )}
                    <EditableText
                        tag="h1"
                        className="classic-name"
                        value={personal.name || ''}
                        onChange={onDataChange ? (v) => updatePersonal('name', v) : undefined}
                        placeholder="John Miller"
                    />
                </div>

                {/* Profile Summary */}
                <section className="classic-section">
                    <h2 className="classic-section-title">{getLabel('summary', lang)}</h2>
                    <EditableText
                        tag="p"
                        className="classic-summary"
                        value={personal.summary || ''}
                        onChange={onDataChange ? (v) => updatePersonal('summary', v) : undefined}
                        placeholder="Enter your professional summary..."
                    />
                </section>

                {/* Contact Details */}
                <section className="classic-section">
                    <h2 className="classic-section-title">{getLabel('contact', lang)}</h2>
                    <div className="classic-contact-list">
                        {personal.email && (
                            <div className="classic-contact-item">
                                <span className="classic-contact-icon">○</span>
                                <span>{personal.email}</span>
                            </div>
                        )}
                        {personal.phone && (
                            <div className="classic-contact-item">
                                <span className="classic-contact-icon">#</span>
                                <span>{personal.phone}</span>
                            </div>
                        )}
                        {personal.address && (
                            <div className="classic-contact-item">
                                <span className="classic-contact-icon">⌂</span>
                                <span>{personal.address}</span>
                            </div>
                        )}
                    </div>
                </section>

                {/* Personal Information */}
                {personal.nationality && (
                    <section className="classic-section">
                        <h2 className="classic-section-title">Personal Information</h2>
                        <div className="classic-info-list">
                            <div className="classic-info-row">
                                <span className="classic-info-label">Citizenship:</span>
                                <span className="classic-info-value">{personal.nationality}</span>
                            </div>
                        </div>
                    </section>
                )}

                {/* Skills */}
                {skills.length > 0 && (
                    <section className="classic-section">
                        <h2 className="classic-section-title">{getLabel('skills', lang)}</h2>
                        <ul className="classic-skills-list">
                            {skills.map((skill, i) => (
                                <li key={skill.id || i}>
                                    <EditableText
                                        tag="span"
                                        value={skill.name || ''}
                                        onChange={onDataChange ? (v) => updateSkill(i, 'name', v) : undefined}
                                        placeholder="Skill"
                                    />
                                </li>
                            ))}
                        </ul>
                    </section>
                )}

                {/* Languages */}
                {languages.length > 0 && (
                    <section className="classic-section">
                        <h2 className="classic-section-title">{getLabel('languages', lang)}</h2>
                        <div className="classic-languages">
                            {languages.map((lang, i) => (
                                <div key={lang.id || i} className="classic-language-row">
                                    <EditableText
                                        tag="span"
                                        className="classic-lang-name"
                                        value={lang.name || ''}
                                        onChange={onDataChange ? (v) => updateLanguage(i, 'name', v) : undefined}
                                        placeholder="Language"
                                    />
                                    <EditableText
                                        tag="span"
                                        className="classic-lang-level"
                                        value={lang.level || ''}
                                        onChange={onDataChange ? (v) => updateLanguage(i, 'level', v) : undefined}
                                        placeholder="Level"
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </aside>

            {/* Main Content */}
            <main className="classic-main">
                {/* Experience */}
                <section className="classic-main-section">
                    <h2 className="classic-main-title">{getLabel('experience', lang)}</h2>
                    <div className="classic-entries">
                        {experience.map((exp, index) => (
                            <div key={exp.id || index} className="classic-entry">
                                <div className="classic-entry-header">
                                    <EditableText
                                        tag="span"
                                        className="classic-job-title"
                                        value={exp.position || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'position', v) : undefined}
                                        placeholder="Position"
                                    />
                                    <span className="classic-company"> at </span>
                                    <EditableText
                                        tag="span"
                                        className="classic-company"
                                        value={exp.company || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'company', v) : undefined}
                                        placeholder="Company"
                                    />
                                    <span className="classic-dates">
                                        <EditableText
                                            tag="span"
                                            value={exp.startDate || ''}
                                            onChange={onDataChange ? (v) => updateExperience(index, 'startDate', v) : undefined}
                                            placeholder="Start"
                                        />–{exp.current ? 'present' : <EditableText
                                            tag="span"
                                            value={exp.endDate || ''}
                                            onChange={onDataChange ? (v) => updateExperience(index, 'endDate', v) : undefined}
                                            placeholder="End"
                                        />}
                                    </span>
                                </div>
                                {(exp.description || onDataChange) && (
                                    <ul className="classic-bullets">
                                        <li>○ <EditableText
                                            tag="span"
                                            value={exp.description || ''}
                                            onChange={onDataChange ? (v) => updateExperience(index, 'description', v) : undefined}
                                            placeholder="Description"
                                        /></li>
                                    </ul>
                                )}
                                {exp.highlights && exp.highlights.map((h, j) => (
                                    <ul key={j} className="classic-bullets">
                                        <li>○ {h}</li>
                                    </ul>
                                ))}
                            </div>
                        ))}
                    </div>
                </section>

                {/* Education */}
                <section className="classic-main-section">
                    <h2 className="classic-main-title">{getLabel('education', lang)}</h2>
                    <div className="classic-entries">
                        {education.map((edu, index) => (
                            <div key={edu.id || index} className="classic-entry">
                                <div className="classic-entry-header">
                                    <EditableText
                                        tag="span"
                                        className="classic-job-title"
                                        value={edu.degree || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'degree', v) : undefined}
                                        placeholder="Degree"
                                    />
                                    <span className="classic-company">. </span>
                                    <EditableText
                                        tag="span"
                                        className="classic-company"
                                        value={edu.field || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'field', v) : undefined}
                                        placeholder="Field of Study"
                                    />
                                    <span className="classic-dates">
                                        <EditableText
                                            tag="span"
                                            value={edu.startDate || ''}
                                            onChange={onDataChange ? (v) => updateEducation(index, 'startDate', v) : undefined}
                                            placeholder="Start"
                                        />–<EditableText
                                            tag="span"
                                            value={edu.endDate || ''}
                                            onChange={onDataChange ? (v) => updateEducation(index, 'endDate', v) : undefined}
                                            placeholder="End"
                                        />
                                    </span>
                                </div>
                                <EditableText
                                    tag="div"
                                    className="classic-institution"
                                    value={edu.institution || ''}
                                    onChange={onDataChange ? (v) => updateEducation(index, 'institution', v) : undefined}
                                    placeholder="Institution"
                                />
                            </div>
                        ))}
                    </div>
                </section>

                {/* Certifications */}
                {showCertificates && certificates && certificates.length > 0 && (
                    <section className="classic-main-section">
                        <h2 className="classic-main-title">{getLabel('certificates', lang)}</h2>
                        <div className="classic-certs">
                            {certificates.map((cert, i) => (
                                <div key={cert.id || i} className="classic-cert-item">
                                    <span className="classic-cert-icon">○</span>
                                    <span className="classic-cert-name">{cert.name}</span>
                                    <span className="classic-cert-issuer">, {cert.issuer}</span>
                                    <span className="classic-cert-date">. {cert.date}</span>
                                </div>
                            ))}
                        </div>
                    </section>
                )}

                {/* Hobbies */}
                {showHobbies && (
                    <section className="classic-main-section">
                        <h2 className="classic-main-title">{getLabel('hobbies', lang)}</h2>
                        <p className="classic-hobbies-text">
                            {data.hobbies?.length
                                ? data.hobbies.map((h) => h.name).join(', ')
                                : personal.summary?.split('.').slice(-2).join('. ') || 'Reading, Music, Sports'}
                        </p>
                    </section>
                )}
            </main>
        </div>
    );
}

export default ClassicCVTemplate;
