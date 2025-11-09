/**
 * Gestionnaire des horaires d'ouverture pour l'épicier
 * Permet de définir les horaires pour chaque jour de la semaine
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

export interface ShopHours {
  [day: string]: {
    isOpen: boolean;
    openTime: string;
    closeTime: string;
  };
}

interface ShopHoursManagerProps {
  initialHours?: ShopHours;
  onSave: (hours: ShopHours) => void;
}

const DAYS_OF_WEEK = [
  { key: 'lundi', label: 'Lundi' },
  { key: 'mardi', label: 'Mardi' },
  { key: 'mercredi', label: 'Mercredi' },
  { key: 'jeudi', label: 'Jeudi' },
  { key: 'vendredi', label: 'Vendredi' },
  { key: 'samedi', label: 'Samedi' },
  { key: 'dimanche', label: 'Dimanche' },
];

const DEFAULT_HOURS: ShopHours = {
  lundi: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
  mardi: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
  mercredi: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
  jeudi: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
  vendredi: { isOpen: true, openTime: '08:00', closeTime: '20:00' },
  samedi: { isOpen: true, openTime: '09:00', closeTime: '20:00' },
  dimanche: { isOpen: false, openTime: '00:00', closeTime: '00:00' },
};

export const ShopHoursManager: React.FC<ShopHoursManagerProps> = ({
  initialHours,
  onSave,
}) => {
  const [hours, setHours] = useState<ShopHours>(initialHours || DEFAULT_HOURS);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [tempOpenTime, setTempOpenTime] = useState('');
  const [tempCloseTime, setTempCloseTime] = useState('');

  const toggleDayOpen = (day: string) => {
    setHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        isOpen: !prev[day].isOpen,
      },
    }));
  };

  const openTimePickerModal = (day: string) => {
    const dayHours = hours[day];
    setSelectedDay(day);
    setTempOpenTime(dayHours.openTime);
    setTempCloseTime(dayHours.closeTime);
    setModalVisible(true);
  };

  const closeTimePickerModal = () => {
    setModalVisible(false);
    setSelectedDay(null);
  };

  const saveTimeChanges = () => {
    if (!selectedDay) return;

    // Validation simple des heures
    const [openHour, openMin] = tempOpenTime.split(':').map(Number);
    const [closeHour, closeMin] = tempCloseTime.split(':').map(Number);

    const openTotalMins = openHour * 60 + openMin;
    const closeTotalMins = closeHour * 60 + closeMin;

    if (openTotalMins >= closeTotalMins) {
      Alert.alert('Erreur', 'L\'heure de fermeture doit être après l\'heure d\'ouverture');
      return;
    }

    setHours(prev => ({
      ...prev,
      [selectedDay]: {
        ...prev[selectedDay],
        openTime: tempOpenTime,
        closeTime: tempCloseTime,
      },
    }));

    closeTimePickerModal();
  };

  const applyToAllWeekdays = () => {
    const weekdayHours = hours.lundi; // Utiliser lundi comme référence

    setHours(prev => ({
      ...prev,
      lundi: weekdayHours,
      mardi: weekdayHours,
      mercredi: weekdayHours,
      jeudi: weekdayHours,
      vendredi: weekdayHours,
    }));

    Alert.alert('✅', 'Horaires appliqués à tous les jours de semaine');
  };

  const applyToAllDays = () => {
    const allDaysHours = hours.lundi;

    setHours(prev => {
      const newHours: ShopHours = {};
      DAYS_OF_WEEK.forEach(day => {
        newHours[day.key] = allDaysHours;
      });
      return newHours;
    });

    Alert.alert('✅', 'Horaires appliqués à tous les jours');
  };

  const handleSave = () => {
    onSave(hours);
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>📅 Horaires d'ouverture</Text>
        <TouchableOpacity
          style={styles.helpButton}
          onPress={() =>
            Alert.alert(
              'Horaires',
              'Définissez vos horaires d\'ouverture pour chaque jour. Les clients verront ces informations.'
            )
          }
        >
          <MaterialIcons name="info" size={20} color="#2196F3" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.daysList} showsVerticalScrollIndicator={false}>
        {DAYS_OF_WEEK.map(day => (
          <View key={day.key} style={styles.dayCard}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{day.label}</Text>
              <Switch
                value={hours[day.key].isOpen}
                onValueChange={() => toggleDayOpen(day.key)}
                trackColor={{ false: '#e0e0e0', true: '#81c784' }}
                thumbColor={hours[day.key].isOpen ? '#4CAF50' : '#ccc'}
              />
            </View>

            {hours[day.key].isOpen && (
              <TouchableOpacity
                style={styles.timeRow}
                onPress={() => openTimePickerModal(day.key)}
              >
                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>Ouverture</Text>
                  <Text style={styles.timeValue}>{hours[day.key].openTime}</Text>
                </View>

                <MaterialIcons name="arrow-forward" size={20} color="#999" />

                <View style={styles.timeBlock}>
                  <Text style={styles.timeLabel}>Fermeture</Text>
                  <Text style={styles.timeValue}>{hours[day.key].closeTime}</Text>
                </View>

                <MaterialIcons name="edit" size={20} color="#2196F3" />
              </TouchableOpacity>
            )}

            {!hours[day.key].isOpen && (
              <View style={styles.closedIndicator}>
                <Text style={styles.closedText}>🚪 Fermé</Text>
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickActionButton}
          onPress={applyToAllWeekdays}
        >
          <MaterialIcons name="content-copy" size={18} color="#fff" />
          <Text style={styles.quickActionText}>Appliquer au semaine</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickActionButton, styles.quickActionButtonSecondary]}
          onPress={applyToAllDays}
        >
          <MaterialIcons name="content-paste" size={18} color="#2196F3" />
          <Text style={[styles.quickActionText, styles.quickActionTextSecondary]}>
            Appliquer à tous
          </Text>
        </TouchableOpacity>
      </View>

      {/* Time Picker Modal */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeTimePickerModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Horaires du{' '}
                {selectedDay
                  ? DAYS_OF_WEEK.find(d => d.key === selectedDay)?.label
                  : ''}
              </Text>
              <TouchableOpacity onPress={closeTimePickerModal}>
                <MaterialIcons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>

            <View style={styles.timePickerContainer}>
              <View style={styles.timePickerField}>
                <Text style={styles.timePickerLabel}>Heure d'ouverture</Text>
                <TextInput
                  style={styles.timePickerInput}
                  value={tempOpenTime}
                  onChangeText={setTempOpenTime}
                  placeholder="HH:MM"
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>

              <View style={styles.timePickerField}>
                <Text style={styles.timePickerLabel}>Heure de fermeture</Text>
                <TextInput
                  style={styles.timePickerInput}
                  value={tempCloseTime}
                  onChangeText={setTempCloseTime}
                  placeholder="HH:MM"
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={closeTimePickerModal}
              >
                <Text style={styles.modalCancelButtonText}>Annuler</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={saveTimeChanges}
              >
                <Text style={styles.modalSaveButtonText}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Save Button */}
      <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
        <MaterialIcons name="check" size={24} color="#fff" />
        <Text style={styles.saveButtonText}>Enregistrer les horaires</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  helpButton: {
    padding: 8,
  },
  daysList: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  dayLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  timeBlock: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
    fontWeight: '500',
  },
  timeValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  closedIndicator: {
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  closedText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#c62828',
  },
  quickActions: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 10,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  quickActionButtonSecondary: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#2196F3',
  },
  quickActionText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 12,
  },
  quickActionTextSecondary: {
    color: '#2196F3',
  },
  saveButton: {
    flexDirection: 'row',
    backgroundColor: '#4CAF50',
    marginHorizontal: 12,
    marginVertical: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  timePickerContainer: {
    gap: 16,
    marginBottom: 20,
  },
  timePickerField: {
    gap: 8,
  },
  timePickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  timePickerInput: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#333',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  modalCancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
