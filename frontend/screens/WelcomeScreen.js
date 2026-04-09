import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';

const HOW_IT_WORKS = [
  'Sign in with Facebook so NoSwipeChat starts from a real identity layer instead of anonymous swiping.',
  'Complete your profile and phone verification before using the full experience.',
  'Choose which extra Facebook-linked categories you want NoSwipeChat to request, such as app-connected friends, timeline posts, or limited social graph signals.',
  'Discover nearby adults, join city-based chats, and message inside the app when features are available.',
  'Optional personality profiling can shape parts of the experience only when you explicitly opt in.'
];

const SOCIAL_DATA_POINTS = [
  'Facebook sign-in still uses core account data such as your Facebook-linked account ID, name, email address, and profile photo URL so NoSwipeChat can create or verify your account.',
  'You can now selectively turn on optional Facebook-linked categories before login, including app-connected friends data, timeline posts, and limited extended social graph signals.',
  'If Facebook grants the selected permissions, NoSwipeChat may store a limited imported summary of app-connected friends, a small sample of timeline posts, and derived social graph counts based on the data Facebook actually returns.',
  'Private-message consent can be recorded in NoSwipeChat, but Facebook Login does not currently expose personal inbox messages directly to this app flow, so selecting that option records intent rather than importing inbox content.',
  'You can choose whether to add optional in-app profile details such as bio, interests, gender, and personality-profile data. Personality storage requires explicit consent and can remain private or be turned off.',
  'You can decline to provide location access, phone number, or date of birth, but some nearby, compliance, or messaging features may not work until required verification steps are completed.',
  'If you later turn a Facebook-linked category off, NoSwipeChat can stop keeping that category active and remove stored summaries for supported imported data.'
];

const TERMS_OF_USE_POINTS = [
  'By continuing, you authorize NoSwipeChat to request the Facebook permissions you actively selected during sign-in and to use the returned data for account setup, trust and safety checks, matching context, and profile features.',
  'Optional Facebook-linked categories are not all-or-nothing. You can leave categories off, and turning on a new category later may require another Facebook login before fresh data can be imported.',
  'Facebook may decline, limit, or review optional permissions such as friends data or timeline posts. If that happens, NoSwipeChat will only use the data categories that Facebook actually grants.',
  'When supported imported social data is turned off later, NoSwipeChat may clear stored summaries for that category from your in-app profile state.',
  'You are responsible for obtaining any permissions required from other people before sharing third-party personal information through chat, profile text, or imported content.'
];

const DISCLAIMER_POINTS = [
  'NoSwipeChat is for adults 18 and older only.',
  'Facebook sign-in and phone verification reduce impersonation risk, but they do not guarantee that every user is safe, truthful, compatible, or acting in good faith.',
  'Profiles, chat messages, and direct messages are user-generated content and may be inaccurate, inappropriate, misleading, or unwanted.',
  'Location-based features may use your approximate location or city to show nearby people and shared chat spaces. Do not post your exact address, workplace, school, or other sensitive details publicly.',
  'If you decide to meet someone in person, you do so at your own risk. Meet in public, tell someone you trust where you are going, and leave immediately if something feels off.',
  'Personality profiling is optional. If you choose to use it, you are sharing additional preference data to help tailor parts of your experience.',
  'Blocking, reporting, and moderation tools can help, but they may not prevent or remove harmful behavior instantly.',
  'Third-party services such as Facebook may be required for sign-in or identity checks, and their availability can affect access to the app.',
  'NoSwipeChat is not an emergency service and should not be used to request urgent help or crisis support.',
  'By continuing, you confirm that the information you provide is accurate, that you will use the service lawfully and respectfully, and that you understand these limits before signing up.'
];

const WelcomeScreen = ({ navigation }) => {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>NoSwipeChat</Text>
        <Text style={styles.title}>Know what you are signing up for before you enter the app.</Text>
        <Text style={styles.subtitle}>
          NoSwipeChat is a verified, location-aware social dating experience for adults who want
          more accountability than swipe-first apps. It combines identity-linked sign-in, city chat,
          nearby discovery, and optional personality tools in one place.
        </Text>

        <View style={styles.heroCard}>
          <Text style={styles.cardTitle}>Brief Description</Text>
          <Text style={styles.cardBody}>
            You are signing up for an adults-only platform where people use Facebook-backed sign-in
            to connect a real social identity, then complete profile, age, phone, and location steps
            as needed to unlock more of the service. People can meet through nearby discovery,
            city-based chatrooms, and direct messaging. In addition to required account data, users
            can now choose whether NoSwipeChat should request optional Facebook-linked data such as
            app-connected friends, timeline posts, and limited social graph signals.
          </Text>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>How NoSwipeChat Works</Text>
          {HOW_IT_WORKS.map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Social Media And Data Choices</Text>
          {SOCIAL_DATA_POINTS.map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Terms Of Use Highlights</Text>
          {TERMS_OF_USE_POINTS.map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Important Disclaimer</Text>
          {DISCLAIMER_POINTS.map((item) => (
            <View key={item} style={styles.listItem}>
              <Text style={styles.bullet}>•</Text>
              <Text style={styles.listText}>{item}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation?.navigate?.('Login')}
        >
          <Text style={styles.primaryButtonText}>Continue To The Main App</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Continuing takes you to sign-in so you can start using NoSwipeChat.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff7f3'
  },
  container: {
    flex: 1
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: '#b35d4e',
    textTransform: 'uppercase',
    marginBottom: 12
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: '#1d1b1a',
    marginBottom: 14
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 25,
    color: '#5d5552',
    marginBottom: 20
  },
  heroCard: {
    backgroundColor: '#1d1b1a',
    borderRadius: 22,
    padding: 22,
    marginBottom: 18
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff7f3',
    marginBottom: 10
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 24,
    color: '#f6d8d0'
  },
  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#f1d5cf',
    marginBottom: 18
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1d1b1a',
    marginBottom: 12
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10
  },
  bullet: {
    width: 18,
    fontSize: 16,
    lineHeight: 22,
    color: '#f04c3e',
    fontWeight: '800'
  },
  listText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22,
    color: '#5d5552'
  },
  primaryButton: {
    backgroundColor: '#f04c3e',
    borderRadius: 16,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 6
  },
  primaryButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800'
  },
  footerNote: {
    fontSize: 13,
    lineHeight: 20,
    color: '#7c706c',
    textAlign: 'center',
    marginTop: 12
  }
});

export default WelcomeScreen;
