import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Meta from '../Meta';
import { useNotification } from '../../contexts/NotificationContext';
import * as ReactRouterDOM from 'react-router-dom';
import { getBusinessByName, createClaim, createBugReport, createReviewAppeal, sendSupportEmail, getRejectedReviewsForUser } from '../../services/supabaseService';
import { useTranslation } from '../../contexts/i18nContext';
import { useCountry } from '../../contexts/CountryContext';
import { COUNTRIES } from '../../constants';

type ActiveTab = 'faq' | 'bug' | 'claim' | 'claim_review';

const FAQItem: React.FC<{ question: string; children: React.ReactNode }> = ({ question, children }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="border-b border-gray-200 dark:border-zinc-700">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex justify-between items-center text-left py-4 font-semibold text-gray-800 dark:text-gray-100"
                aria-expanded={isOpen}
            >
                <span>{question}</span>
                <i className={`fa-solid fa-chevron-down transition-transform ${isOpen ? 'rotate-180' : ''}`}></i>
            </button>
            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-96' : 'max-h-0'}`}>
                <div className="pb-4 text-gray-600 dark:text-gray-300">
                    {children}
                </div>
            </div>
        </div>
    );
};


const SupportPage: React.FC = () => {
    const { user, profile } = useAuth();
    const location = ReactRouterDOM.useLocation();
    const { showNotification } = useNotification();
    const t = useTranslation();
    const { country } = useCountry();

    // SEO: Obtener nombre del país para títulos únicos
    const countryName = COUNTRIES.find(c => c.code === country)?.name || '';
    const countryInTitle = countryName ? ` ${t('common.in')} ${countryName}` : '';

    const [activeTab, setActiveTab] = useState<ActiveTab>('faq');
    const [isSubmitting, setIsSubmitting] = useState(false);
    
    const [bugFormData, setBugFormData] = useState({
        username: '',
        email: '',
        pageUrl: '',
        description: '',
    });

    const [claimFormData, setClaimFormData] = useState({
        username: '',
        email: '',
        opynioUrl: '',
        websiteUrl: '',
        phone: '',
        comments: ''
    });

    const [claimReviewFormData, setClaimReviewFormData] = useState({
        username: '',
        email: '',
        reviewId: '',
        reviewTitle: '',
        reason: ''
    });
    
    const [rejectedReviews, setRejectedReviews] = useState<{ id: number; title: string; }[]>([]);
    const [loadingRejectedReviews, setLoadingRejectedReviews] = useState(false);


    // Effect to handle initial tab and data from navigation state
    useEffect(() => {
        const state = location.state as { initialTab?: ActiveTab, claimUrl?: string, reviewId?: number, reviewTitle?: string } | null;
        if (state?.initialTab) {
            setActiveTab(state.initialTab);
        }
        if (state?.claimUrl) {
            setClaimFormData(prev => ({ ...prev, opynioUrl: state.claimUrl }));
        }
        if (state?.initialTab === 'claim_review') {
            setClaimReviewFormData(prev => ({
                ...prev,
                reviewId: state.reviewId?.toString() || '',
                reviewTitle: state.reviewTitle || '',
            }));
        }
    }, [location.state]);

    // Effect to pre-fill user data
    useEffect(() => {
        if (user && profile) {
            const userData = {
                username: profile.username || profile.name,
                email: user.email || ''
            };
            setBugFormData(prev => ({ ...prev, ...userData }));
            setClaimFormData(prev => ({ ...prev, ...userData }));
            setClaimReviewFormData(prev => ({...prev, ...userData}));
        }
    }, [user, profile]);

    // Separate effect to fetch rejected reviews - only runs when needed
    useEffect(() => {
        if (user && activeTab === 'claim_review') {
            let isMounted = true;
            const fetchRejected = async () => {
                setLoadingRejectedReviews(true);
                try {
                    const reviews = await getRejectedReviewsForUser(user.id);
                    if (isMounted) {
                        setRejectedReviews(reviews);
                    }
                } catch (error) {
                    // Silently fail - just show empty list
                    console.error('Error loading rejected reviews:', error);
                    if (isMounted) {
                        setRejectedReviews([]);
                    }
                } finally {
                    if (isMounted) {
                        setLoadingRejectedReviews(false);
                    }
                }
            };
            fetchRejected();
            return () => { isMounted = false; };
        }
    }, [user, activeTab]);


    const handleBugFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setBugFormData(prev => ({ ...prev, [id]: value }));
    };

    const handleClaimFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { id, value } = e.target;
        setClaimFormData(prev => ({ ...prev, [id]: value }));
    };
    
    const handleClaimReviewFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { id, value } = e.target;
        if (id === 'reviewId') {
            const selectedReview = rejectedReviews.find(r => r.id.toString() === value);
            setClaimReviewFormData(prev => ({
                ...prev,
                reviewId: value,
                reviewTitle: selectedReview ? selectedReview.title : ''
            }));
        } else {
            setClaimReviewFormData(prev => ({ ...prev, [id]: value }));
        }
    };

    const handleBugSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) {
            showNotification(t('supportPage.mustLogInToReportBug'), 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            const bugData = {
                user_id: user.id,
                description: `URL: ${bugFormData.pageUrl || 'No especificada'}\n\n${bugFormData.description}`,
                status: 'open',
            };
            console.log('Creating bug report with data:', bugData);
            await createBugReport(bugData);

            // Try to send email notification, but don't fail if it doesn't work
            try {
                await sendSupportEmail('bug', {
                    username: bugFormData.username,
                    email: bugFormData.email,
                    pageUrl: bugFormData.pageUrl,
                    description: bugFormData.description,
                });
            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
                // Continue anyway - the bug report was saved successfully
            }

            showNotification(t('supportPage.bugReportSentSuccess'), 'success');
            setBugFormData(prev => ({...prev, pageUrl: '', description: ''}));
        } catch (error: any) {
            showNotification(error.message || t('supportPage.errorSending'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClaimSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) {
            showNotification(t('supportPage.mustLogInToClaim'), 'error');
            return;
        }

        const businessUrl = claimFormData.opynioUrl;
        if (!businessUrl) {
             showNotification(t('supportPage.opynioURLRequired'), 'error');
            return;
        }

        // Match business URLs in any language: empresa, unternehmen, business, entreprise, azienda, etc.
        const nameMatch = businessUrl.match(/\/(empresa|unternehmen|business|entreprise|azienda|公司)\/([^/?#]+)/);
        if (!nameMatch || !nameMatch[2]) {
            showNotification(t('supportPage.invalidOpynioURL'), 'error');
            return;
        }

        setIsSubmitting(true);
        try {
            const businessName = decodeURIComponent(nameMatch[2].replace(/_/g, ' '));
            const business = await getBusinessByName(businessName);

            if (!business) {
                showNotification(t('supportPage.businessURLNotFound'), 'error');
                setIsSubmitting(false);
                return;
            }
            
            await createClaim({
                user_id: user.id,
                business_id: business.id,
                opynio_url: claimFormData.opynioUrl,
                user_provided_info: {
                    websiteUrl: claimFormData.websiteUrl,
                    phone: claimFormData.phone,
                    comments: claimFormData.comments
                }
            });

            // Try to send email notification, but don't fail if it doesn't work
            try {
                await sendSupportEmail('claim', {
                    username: claimFormData.username,
                    email: claimFormData.email,
                    opynioUrl: claimFormData.opynioUrl,
                    websiteUrl: claimFormData.websiteUrl,
                    phone: claimFormData.phone,
                    comments: claimFormData.comments
                });
            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
                // Continue anyway - the claim was saved successfully
            }

            showNotification(t('supportPage.claimSentSuccess'), 'success');
            setClaimFormData({ username: profile?.username || profile?.name || '', email: user?.email || '', opynioUrl: '', websiteUrl: '', phone: '', comments: '' });

        } catch (error: any) {
            showNotification(error.message || t('supportPage.errorSending'), 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleClaimReviewSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!user) {
            showNotification(t('supportPage.mustLogInToAppeal'), 'error');
            return;
        }
        if (!claimReviewFormData.reviewId || !claimReviewFormData.reason.trim()) {
            showNotification(t('supportPage.completeAllAppealFields'), 'error');
            return;
        }
        setIsSubmitting(true);
        try {
            await createReviewAppeal({
                userId: user.id,
                reviewId: parseInt(claimReviewFormData.reviewId, 10),
                reason: claimReviewFormData.reason.trim(),
            });

            // Try to send email notification, but don't fail if it doesn't work
            try {
                await sendSupportEmail('claim_review', {
                    username: claimReviewFormData.username,
                    email: claimReviewFormData.email,
                    reviewId: claimReviewFormData.reviewId,
                    reviewTitle: claimReviewFormData.reviewTitle,
                    reason: claimReviewFormData.reason.trim(),
                });
            } catch (emailError) {
                console.error('Failed to send email notification:', emailError);
                // Continue anyway - the appeal was saved successfully
            }

            showNotification(t('supportPage.appealSentSuccess'), 'success');
            setClaimReviewFormData(prev => ({...prev, reason: '', reviewId: '', reviewTitle: ''}));

        } catch (error: any) {
            showNotification(error.message || 'Error al enviar la apelación.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };
    
    const TabButton: React.FC<{ tabId: ActiveTab; icon: string; label: string }> = ({ tabId, icon, label }) => (
        <button
            onClick={() => setActiveTab(tabId)}
            className={`flex items-center justify-center gap-1.5 px-2 sm:px-4 py-3 font-semibold border-b-2 transition-colors text-xs sm:text-sm whitespace-nowrap ${
                activeTab === tabId
                ? 'border-brand-green text-brand-green'
                : 'border-transparent text-gray-500 hover:text-brand-dark dark:text-gray-400 dark:hover:text-gray-100'
            }`}
        >
            <i className={`fa-solid ${icon}`}></i>
            <span className="hidden xs:inline sm:inline">{label}</span>
        </button>
    );

    return (
        <>
            <Meta title={`${t('supportPage.helpAndSupportTitle')} - Opynio${countryInTitle}`} description={`${t('supportPage.helpAndSupportSubtitle')}${countryInTitle}.`} />
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-extrabold text-brand-dark dark:text-white">{t('supportPage.helpAndSupportTitle')}{countryInTitle}</h1>
                    <p className="text-lg text-gray-600 dark:text-gray-400 mt-2">{t('supportPage.helpAndSupportSubtitle')}</p>
                </div>

                <div className="bg-white dark:bg-zinc-800 p-2 sm:p-4 rounded-xl shadow-lg border border-gray-200 dark:border-zinc-800">
                    <div className="border-b border-gray-200 dark:border-zinc-700 mb-6 flex flex-wrap justify-center sm:justify-start overflow-x-auto">
                        <TabButton tabId="faq" icon="fa-question-circle" label={t('supportPage.faq')} />
                        <TabButton tabId="bug" icon="fa-bug" label={t('supportPage.reportBug')} />
                        <TabButton tabId="claim" icon="fa-store" label={t('supportPage.claimBusiness')} />
                        <TabButton tabId="claim_review" icon="fa-flag" label={t('supportPage.appealReview')} />
                    </div>

                    <div className="p-2 sm:p-4">
                        {activeTab === 'faq' && (
                            <div className="space-y-2">
                                <FAQItem question={t('supportPage.faqSupport1Q')}>
                                    <p>{t('supportPage.faqSupport1A')}</p>
                                </FAQItem>
                                <FAQItem question={t('supportPage.faqSupport2Q')}>
                                    <p>{t('supportPage.faqSupport2A')}</p>
                                </FAQItem>
                                <FAQItem question={t('supportPage.faqSupport3Q')}>
                                    <p>{t('supportPage.faqSupport3A')}</p>
                                </FAQItem>
                                <FAQItem question={t('supportPage.faqSupport4Q')}>
                                    <p>{t('supportPage.faqSupport4A')}</p>
                                </FAQItem>
                                <FAQItem question={t('supportPage.faqSupport5Q')}>
                                    <p>{t('supportPage.faqSupport5A')}</p>
                                </FAQItem>
                                <FAQItem question={t('supportPage.faqSupport6Q')}>
                                    <p>{t('supportPage.faqSupport6A')}</p>
                                </FAQItem>
                                <FAQItem question={t('supportPage.faqSupport7Q')}>
                                    <p>{t('supportPage.faqSupport7A')}</p>
                                </FAQItem>
                                <FAQItem question={t('supportPage.faqSupport8Q')}>
                                    <p>{t('supportPage.faqSupport8A')}</p>
                                </FAQItem>
                            </div>
                        )}
                        
                         {activeTab === 'bug' && (
                             <form onSubmit={handleBugSubmit} className="space-y-4 max-w-lg mx-auto">
                                 <p className="text-sm text-center text-gray-500 dark:text-gray-400">{t('supportPage.reportBugSubtitle')}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.yourUsernameOrName')}</label><input id="username" type="text" value={bugFormData.username} onChange={handleBugFormChange} required className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 cursor-not-allowed" disabled={!!user}/></div>
                                    <div><label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.yourEmail')}</label><input id="email" type="email" value={bugFormData.email} onChange={handleBugFormChange} required className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 cursor-not-allowed" disabled={!!user}/></div>
                                </div>
                                <div><label htmlFor="pageUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.errorPageURL')}</label><input id="pageUrl" type="url" value={bugFormData.pageUrl} onChange={handleBugFormChange} placeholder={t('common.placeholders.appUrl')} className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-200"/></div>
                                <div><label htmlFor="description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.describeTheError')}</label><textarea id="description" value={bugFormData.description} onChange={handleBugFormChange} required rows={4} className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-200"></textarea></div>
                                <button type="submit" disabled={isSubmitting} className="w-full bg-brand-green text-white font-bold py-2.5 px-4 rounded-lg">{isSubmitting ? t('common.sending') : t('supportPage.sendReport')}</button>
                            </form>
                        )}
                        
                        {activeTab === 'claim' && (
                             <form onSubmit={handleClaimSubmit} className="space-y-4 max-w-lg mx-auto">
                                <p className="text-sm text-center text-gray-500 dark:text-gray-400">{t('supportPage.claimBusinessSubtitle')}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.yourUsernameOrName')}</label><input id="username" type="text" value={claimFormData.username} onChange={handleClaimFormChange} required className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 cursor-not-allowed" disabled={!!user}/></div>
                                    <div><label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.yourEmail')}</label><input id="email" type="email" value={claimFormData.email} onChange={handleClaimFormChange} required className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 cursor-not-allowed" disabled={!!user}/></div>
                                </div>
                                <div><label htmlFor="opynioUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.opynioPageURLToClaim')}</label><input id="opynioUrl" type="url" value={claimFormData.opynioUrl} onChange={handleClaimFormChange} required placeholder={t('common.placeholders.opynioUrl')} className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-200"/></div>
                                <div><label htmlFor="websiteUrl" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.businessOfficialWebsiteURL')}</label><input id="websiteUrl" type="url" value={claimFormData.websiteUrl} onChange={handleClaimFormChange} required placeholder={t('common.placeholders.websiteUrl')} className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-200"/></div>
                                <div><label htmlFor="phone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.businessOfficialPhone')}</label><input id="phone" type="tel" value={claimFormData.phone} onChange={handleClaimFormChange} required placeholder={t('common.placeholders.phone')} className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-200"/></div>
                                <div><label htmlFor="comments" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.additionalComments')}</label><textarea id="comments" value={claimFormData.comments} onChange={handleClaimFormChange} rows={3} placeholder={t('common.placeholders.writeResponse')} className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-200"></textarea></div>
                                <button type="submit" disabled={isSubmitting} className="w-full bg-brand-green text-white font-bold py-2.5 px-4 rounded-lg">{isSubmitting ? t('common.sending') : t('supportPage.sendClaim')}</button>
                            </form>
                        )}

                        {activeTab === 'claim_review' && (
                             <form onSubmit={handleClaimReviewSubmit} className="space-y-4 max-w-lg mx-auto">
                                <p className="text-sm text-center text-gray-500 dark:text-gray-400">{t('supportPage.appealReviewSubtitle')}</p>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><label htmlFor="username" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('common.username')}</label><input id="username" type="text" value={claimReviewFormData.username} readOnly className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"/></div>
                                    <div><label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.yourEmail')}</label><input id="email" type="email" value={claimReviewFormData.email} readOnly className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"/></div>
                                </div>
                                <div>
                                    <label htmlFor="reviewId" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.rejectedReview')}</label>
                                    <select 
                                        id="reviewId" 
                                        name="reviewId"
                                        value={claimReviewFormData.reviewId} 
                                        onChange={handleClaimReviewFormChange} 
                                        required 
                                        className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-200 focus:ring-brand-green focus:border-brand-green"
                                        disabled={loadingRejectedReviews || rejectedReviews.length === 0}
                                    >
                                        <option value="" disabled>
                                            {loadingRejectedReviews ? t('supportPage.loadingReviews') : t('supportPage.selectAReview')}
                                        </option>
                                        {rejectedReviews.length > 0 ? (
                                            rejectedReviews.map(review => (
                                                <option key={review.id} value={review.id}>{review.title}</option>
                                            ))
                                        ) : (
                                            !loadingRejectedReviews && <option disabled>{t('supportPage.noRejectedReviews')}</option>
                                        )}
                                    </select>
                                </div>
                                <div><label htmlFor="reason" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('supportPage.reasonForAppeal')}</label><textarea id="reason" name="reason" value={claimReviewFormData.reason} onChange={handleClaimReviewFormChange} required rows={4} className="w-full p-2 border border-gray-300 dark:border-zinc-700 rounded-md bg-gray-50 dark:bg-zinc-900 text-gray-900 dark:text-gray-200"></textarea></div>
                                <button type="submit" disabled={isSubmitting} className="w-full bg-brand-green text-white font-bold py-2.5 px-4 rounded-lg">{isSubmitting ? t('common.sending') : t('supportPage.sendAppeal')}</button>
                            </form>
                        )}

                    </div>
                </div>
            </div>
        </>
    );
};

export default SupportPage;