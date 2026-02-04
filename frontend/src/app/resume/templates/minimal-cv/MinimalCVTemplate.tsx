import { useCallback } from 'react';
import type { ResumeData, StyleSettings } from '../../types/resume';
import { darkenColor } from '../../utils/colorUtils';
import { EditableText } from '../../components/EditableText';
import { getLabel, getLabelUpper } from '../../lib/i18n/resumeLabels';
import './MinimalCVTemplate.css';

interface MinimalCVTemplateProps {
    data: ResumeData;
    style: StyleSettings;
    onDataChange?: (data: ResumeData) => void;
}

export function MinimalCVTemplate({ data, style, onDataChange }: MinimalCVTemplateProps) {
    const visibility = data.sectionVisibility;
    const showPublications = visibility?.publications ?? data.publications.length > 0;
    const showAwards = visibility?.awards ?? data.awards.length > 0;
    const showCertificates = visibility?.certificates ?? data.certificates.length > 0;
    const showHobbies = visibility?.hobbies ?? data.hobbies.length > 0;
    const lang = style.resumeLanguage || 'en';

    const cssVars = {
        '--primary-color': style.primaryColor,
        '--primary-dark': darkenColor(style.primaryColor, 15),
        '--sidebar-width': `${style.sidebarWidth}%`,
        '--font-size': `${style.fontSize}pt`,
        '--line-height': style.lineHeight,
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

    const updateLanguage = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newLangs = [...data.languages];
            newLangs[index] = { ...newLangs[index], [field]: value };
            onDataChange({ ...data, languages: newLangs });
        }
    }, [data, onDataChange]);

    const updatePublication = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newPubs = [...data.publications];
            newPubs[index] = { ...newPubs[index], [field]: value };
            onDataChange({ ...data, publications: newPubs });
        }
    }, [data, onDataChange]);

    const updateAward = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newAwards = [...data.awards];
            newAwards[index] = { ...newAwards[index], [field]: value };
            onDataChange({ ...data, awards: newAwards });
        }
    }, [data, onDataChange]);

    const updateCertificate = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newCerts = [...data.certificates];
            newCerts[index] = { ...newCerts[index], [field]: value };
            onDataChange({ ...data, certificates: newCerts });
        }
    }, [data, onDataChange]);

    const updateHobby = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newHobbies = [...data.hobbies];
            newHobbies[index] = { ...newHobbies[index], [field]: value };
            onDataChange({ ...data, hobbies: newHobbies });
        }
    }, [data, onDataChange]);

    const updateSocialLink = useCallback((index: number, field: string, value: string) => {
        if (onDataChange) {
            const newLinks = [...data.socialLinks];
            newLinks[index] = { ...newLinks[index], [field]: value };
            onDataChange({ ...data, socialLinks: newLinks });
        }
    }, [data, onDataChange]);

    return (
        <div className="minimal-container" style={cssVars}>
            {/* Left Sidebar */}
            <aside className="minimal-sidebar">
                {/* Photo */}
                {data.personal.photo && (
                    <div className="minimal-photo-container">
                        <img src={data.personal.photo} alt="" className="minimal-photo" />
                    </div>
                )}

                {/* Name */}
                <div className="minimal-name-section">
                    <EditableText
                        tag="h1"
                        className="minimal-name"
                        value={data.personal.name || ''}
                        onChange={onDataChange ? (v) => updatePersonal('name', v) : undefined}
                        placeholder="CARL F. GAUSS"
                    />
                    <EditableText
                        tag="p"
                        className="minimal-subtitle"
                        value={data.personal.title || ''}
                        onChange={onDataChange ? (v) => updatePersonal('title', v) : undefined}
                        placeholder="THE FOREMOST OF MATHEMATICIANS"
                    />
                </div>

                {/* Contact */}
                <section className="minimal-section">
                    <h3 className="minimal-section-title">{getLabelUpper('contact', lang)}</h3>
                    {(data.personal.address || onDataChange) && (
                        <div className="minimal-contact-item">
                            <span className="contact-icon">📍</span>
                            <span>Address<br /><EditableText
                                tag="span"
                                value={data.personal.address || ''}
                                onChange={onDataChange ? (v) => updatePersonal('address', v) : undefined}
                                placeholder="Your Address"
                            /></span>
                        </div>
                    )}
                    {(data.personal.phone || onDataChange) && (
                        <div className="minimal-contact-item">
                            <span className="contact-icon">📞</span>
                            <span>Phone<br /><EditableText
                                tag="span"
                                value={data.personal.phone || ''}
                                onChange={onDataChange ? (v) => updatePersonal('phone', v) : undefined}
                                placeholder="+1 234 567 890"
                            /></span>
                        </div>
                    )}
                    {(data.personal.email || onDataChange) && (
                        <div className="minimal-contact-item">
                            <span className="contact-icon">✉️</span>
                            <span>E-Mail<br /><EditableText
                                tag="span"
                                value={data.personal.email || ''}
                                onChange={onDataChange ? (v) => updatePersonal('email', v) : undefined}
                                placeholder="email@example.com"
                            /></span>
                        </div>
                    )}
                </section>

                {/* Personal */}
                <section className="minimal-section">
                    <h3 className="minimal-section-title">PERSONAL</h3>
                    {(data.personal.birthday || onDataChange) && (
                        <div className="minimal-info-item">
                            <span className="info-icon">🎂</span>
                            <span>Date of Birth<br /><EditableText
                                tag="span"
                                value={data.personal.birthday || ''}
                                onChange={onDataChange ? (v) => updatePersonal('birthday', v) : undefined}
                                placeholder="YYYY-MM-DD"
                            /></span>
                        </div>
                    )}
                    {(data.personal.nationality || onDataChange) && (
                        <div className="minimal-info-item">
                            <span className="info-icon">🌍</span>
                            <span>Nationality<br /><EditableText
                                tag="span"
                                value={data.personal.nationality || ''}
                                onChange={onDataChange ? (v) => updatePersonal('nationality', v) : undefined}
                                placeholder="Nationality"
                            /></span>
                        </div>
                    )}
                </section>

                {/* Social Links */}
                {data.socialLinks.length > 0 && (
                    <section className="minimal-section">
                        <h3 className="minimal-section-title">PLATFORMS</h3>
                        {data.socialLinks.map((link, i) => (
                            <div key={link.platform} className="minimal-info-item">
                                <span className="info-icon">{link.icon}</span>
                                <span><EditableText
                                    tag="span"
                                    value={link.platform || ''}
                                    onChange={onDataChange ? (v) => updateSocialLink(i, 'platform', v) : undefined}
                                    placeholder="Platform"
                                /><br /><EditableText
                                        tag="span"
                                        value={link.username || ''}
                                        onChange={onDataChange ? (v) => updateSocialLink(i, 'username', v) : undefined}
                                        placeholder="Username"
                                    /></span>
                            </div>
                        ))}
                    </section>
                )}

                {/* Languages */}
                {data.languages.length > 0 && (
                    <section className="minimal-section">
                        <h3 className="minimal-section-title">{getLabelUpper('languages', lang)}</h3>
                        {data.languages.map((langItem, i) => (
                            <div key={langItem.id} className="minimal-lang-item">
                                <span className="lang-flag">{langItem.flag}</span>
                                <div className="lang-info">
                                    <EditableText
                                        tag="span"
                                        className="lang-name"
                                        value={langItem.name || ''}
                                        onChange={onDataChange ? (v) => updateLanguage(i, 'name', v) : undefined}
                                        placeholder="Language"
                                    />
                                    <EditableText
                                        tag="span"
                                        className="lang-level"
                                        value={langItem.level || ''}
                                        onChange={onDataChange ? (v) => updateLanguage(i, 'level', v) : undefined}
                                        placeholder="Level"
                                    />
                                </div>
                            </div>
                        ))}
                    </section>
                )}
            </aside>

            {/* Main Content */}
            <main className="minimal-main">
                {/* Education */}
                {data.education.length > 0 && (
                    <section className="minimal-main-section">
                        <h2 className="minimal-main-title">{getLabelUpper('education', lang)}</h2>
                        {data.education.map((edu, index) => (
                            <div key={edu.id} className="minimal-entry">
                                <div className="entry-date">
                                    <EditableText
                                        tag="span"
                                        value={edu.startDate || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'startDate', v) : undefined}
                                        placeholder="Start"
                                    /> - <EditableText
                                        tag="span"
                                        value={edu.endDate || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'endDate', v) : undefined}
                                        placeholder="End"
                                    />
                                </div>
                                <div className="entry-content">
                                    <EditableText
                                        tag="div"
                                        className="entry-title"
                                        value={edu.institution || ''}
                                        onChange={onDataChange ? (v) => updateEducation(index, 'institution', v) : undefined}
                                        placeholder="Institution"
                                    />
                                    <div className="entry-subtitle">
                                        <EditableText
                                            tag="span"
                                            value={edu.degree || ''}
                                            onChange={onDataChange ? (v) => updateEducation(index, 'degree', v) : undefined}
                                            placeholder="Degree"
                                        />
                                        {' of '}
                                        <EditableText
                                            tag="span"
                                            value={edu.field || ''}
                                            onChange={onDataChange ? (v) => updateEducation(index, 'field', v) : undefined}
                                            placeholder="Field"
                                        />
                                    </div>
                                    {(edu.description || onDataChange) && (
                                        <EditableText
                                            tag="div"
                                            className="entry-desc"
                                            value={edu.description || ''}
                                            onChange={onDataChange ? (v) => updateEducation(index, 'description', v) : undefined}
                                            placeholder="Description"
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </section>
                )}

                {/* Work Experience */}
                {data.experience.length > 0 && (
                    <section className="minimal-main-section">
                        <h2 className="minimal-main-title">{getLabelUpper('experience', lang)}</h2>
                        {data.experience.map((exp, index) => (
                            <div key={exp.id} className="minimal-entry">
                                <div className="entry-date">
                                    <EditableText
                                        tag="span"
                                        value={exp.startDate || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'startDate', v) : undefined}
                                        placeholder="Start"
                                    />{exp.endDate ? <> - <EditableText
                                        tag="span"
                                        value={exp.endDate || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'endDate', v) : undefined}
                                        placeholder="End"
                                    /></> : ''}
                                </div>
                                <div className="entry-content">
                                    <EditableText
                                        tag="div"
                                        className="entry-title"
                                        value={exp.company || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'company', v) : undefined}
                                        placeholder="Company"
                                    />
                                    <EditableText
                                        tag="div"
                                        className="entry-subtitle"
                                        value={exp.position || ''}
                                        onChange={onDataChange ? (v) => updateExperience(index, 'position', v) : undefined}
                                        placeholder="Position"
                                    />
                                    {(exp.description || onDataChange) && (
                                        <EditableText
                                            tag="div"
                                            className="entry-desc"
                                            value={exp.description || ''}
                                            onChange={onDataChange ? (v) => updateExperience(index, 'description', v) : undefined}
                                            placeholder="Description"
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </section>
                )}

                {showPublications && data.publications.length > 0 && (
                    <section className="minimal-main-section">
                        <h2 className="minimal-main-title">{getLabelUpper('publications', lang)}</h2>
                        {data.publications.map((pub, i) => (
                            <div key={pub.id} className="minimal-pub">
                                <EditableText
                                    tag="span"
                                    className="pub-date"
                                    value={pub.date || ''}
                                    onChange={onDataChange ? (v) => updatePublication(i, 'date', v) : undefined}
                                    placeholder="Date"
                                />
                                <EditableText
                                    tag="span"
                                    className="pub-title"
                                    value={pub.title || ''}
                                    onChange={onDataChange ? (v) => updatePublication(i, 'title', v) : undefined}
                                    placeholder="Title"
                                />
                            </div>
                        ))}
                    </section>
                )}

                {showAwards && data.awards.length > 0 && (
                    <section className="minimal-main-section">
                        <h2 className="minimal-main-title">{getLabelUpper('awards', lang)}</h2>
                        {data.awards.map((award, i) => (
                            <div key={award.id} className="minimal-pub">
                                <EditableText
                                    tag="span"
                                    className="pub-date"
                                    value={award.date || ''}
                                    onChange={onDataChange ? (v) => updateAward(i, 'date', v) : undefined}
                                    placeholder="Date"
                                />
                                <EditableText
                                    tag="span"
                                    className="pub-title"
                                    value={award.title || ''}
                                    onChange={onDataChange ? (v) => updateAward(i, 'title', v) : undefined}
                                    placeholder="Award"
                                />
                            </div>
                        ))}
                    </section>
                )}

                {showCertificates && data.certificates.length > 0 && (
                    <section className="minimal-main-section">
                        <h2 className="minimal-main-title">{getLabelUpper('certificates', lang)}</h2>
                        {data.certificates.map((cert, i) => (
                            <div key={cert.id} className="minimal-entry">
                                <EditableText
                                    tag="div"
                                    className="entry-date"
                                    value={cert.date || ''}
                                    onChange={onDataChange ? (v) => updateCertificate(i, 'date', v) : undefined}
                                    placeholder="Date"
                                />
                                <div className="entry-content">
                                    <EditableText
                                        tag="div"
                                        className="entry-title"
                                        value={cert.name || ''}
                                        onChange={onDataChange ? (v) => updateCertificate(i, 'name', v) : undefined}
                                        placeholder="Certificate Name"
                                    />
                                    <EditableText
                                        tag="div"
                                        className="entry-subtitle"
                                        value={cert.issuer || ''}
                                        onChange={onDataChange ? (v) => updateCertificate(i, 'issuer', v) : undefined}
                                        placeholder="Issuer"
                                    />
                                </div>
                            </div>
                        ))}
                    </section>
                )}

                {showHobbies && data.hobbies.length > 0 && (
                    <section className="minimal-main-section">
                        <h2 className="minimal-main-title">{getLabelUpper('hobbies', lang)}</h2>
                        <div className="minimal-hobbies">
                            {data.hobbies.map((hobby, i) => (
                                <EditableText
                                    key={hobby.id}
                                    tag="span"
                                    className="hobby-item"
                                    value={hobby.name || ''}
                                    onChange={onDataChange ? (v) => updateHobby(i, 'name', v) : undefined}
                                    placeholder="Hobby"
                                />
                            ))}
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}
